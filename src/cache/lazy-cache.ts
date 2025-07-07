import { BCApp, CacheEntry } from '../types/bc-types.js';
import { StreamingSymbolParser } from '../processors/streaming-parser.js';

interface LazyObjectCache {
  [objectKey: string]: any;
}

interface LazyAppEntry {
  appData: BCApp;
  symbolsBuffer: Buffer;
  streamingParser: StreamingSymbolParser;
  objectCache: LazyObjectCache;
  timestamp: number;
  fileHash: string;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  totalApps: number;
  totalObjects: number;
  loadedObjects: number;
  memoryUsage: number;
  cacheHitRate: number;
  averageLoadTime: number;
}

export class LazyMemoryCache {
  private cache: { [filePath: string]: LazyAppEntry } = {};
  private maxAge: number;
  private maxMemoryMB: number;
  private accessLog: { hits: number; misses: number } = { hits: 0, misses: 0 };

  constructor(maxAgeMinutes: number = 60, maxMemoryMB: number = 512) {
    this.maxAge = maxAgeMinutes * 60 * 1000;
    this.maxMemoryMB = maxMemoryMB;
  }

  /**
   * Store an app with lazy loading capabilities
   */
  async setLazy(filePath: string, app: BCApp, symbolsBuffer: Buffer): Promise<void> {
    const streamingParser = new StreamingSymbolParser();
    await streamingParser.parseSymbolsProgressive(symbolsBuffer);

    this.cache[filePath] = {
      appData: app,
      symbolsBuffer,
      streamingParser,
      objectCache: {},
      timestamp: Date.now(),
      fileHash: app.fileHash,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    // Check memory limits and evict if necessary
    await this.enforceMemoryLimits();
  }

  /**
   * Get app metadata without loading symbols
   */
  getAppMetadata(filePath: string, currentFileHash: string): BCApp | null {
    const entry = this.cache[filePath];
    
    if (!entry || !this.isEntryValid(entry, currentFileHash)) {
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry.appData;
  }

  /**
   * Load objects of specific type on demand
   */
  async loadObjectsByType(
    filePath: string, 
    currentFileHash: string, 
    objectType: string
  ): Promise<any[]> {
    const entry = this.cache[filePath];
    
    if (!entry || !this.isEntryValid(entry, currentFileHash)) {
      this.accessLog.misses++;
      return [];
    }

    const cacheKey = `${objectType}:all`;
    
    // Check if objects are already cached
    if (entry.objectCache[cacheKey]) {
      this.accessLog.hits++;
      entry.lastAccessed = Date.now();
      return entry.objectCache[cacheKey];
    }

    // Load objects using streaming parser
    const objects = await entry.streamingParser.loadObjectsByType(objectType);
    entry.objectCache[cacheKey] = objects;
    entry.lastAccessed = Date.now();
    this.accessLog.misses++;

    return objects;
  }

  /**
   * Load specific object on demand
   */
  async loadObject(
    filePath: string,
    currentFileHash: string,
    objectType: string,
    objectId: number,
    objectName: string
  ): Promise<any | null> {
    const entry = this.cache[filePath];
    
    if (!entry || !this.isEntryValid(entry, currentFileHash)) {
      this.accessLog.misses++;
      return null;
    }

    const cacheKey = `${objectType}:${objectId}:${objectName}`;
    
    // Check if object is already cached
    if (entry.objectCache[cacheKey]) {
      this.accessLog.hits++;
      entry.lastAccessed = Date.now();
      return entry.objectCache[cacheKey];
    }

    // Load object using streaming parser
    try {
      const object = await entry.streamingParser.loadObject(objectType, objectId, objectName);
      entry.objectCache[cacheKey] = object;
      entry.lastAccessed = Date.now();
      this.accessLog.misses++;
      return object;
    } catch (error) {
      this.accessLog.misses++;
      return null;
    }
  }

  /**
   * Get object metadata without loading full object
   */
  getObjectMetadata(
    filePath: string,
    currentFileHash: string,
    objectType: string,
    objectId?: number,
    objectName?: string
  ): any[] {
    const entry = this.cache[filePath];
    
    if (!entry || !this.isEntryValid(entry, currentFileHash)) {
      return [];
    }

    entry.lastAccessed = Date.now();
    return entry.streamingParser.getObjectMetadata(objectType, objectId, objectName);
  }

  /**
   * Get loading statistics for an app
   */
  getLoadingStats(filePath: string, currentFileHash: string): any {
    const entry = this.cache[filePath];
    
    if (!entry || !this.isEntryValid(entry, currentFileHash)) {
      return null;
    }

    return entry.streamingParser.getLoadingStats();
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): CacheStats {
    const totalObjects = Object.values(this.cache).reduce(
      (sum, entry) => sum + Object.keys(entry.objectCache).length, 0
    );

    const loadedObjects = Object.values(this.cache).reduce(
      (sum, entry) => sum + entry.streamingParser.getLoadingStats().loaded, 0
    );

    const memoryUsage = this.calculateMemoryUsage();
    const totalRequests = this.accessLog.hits + this.accessLog.misses;
    const cacheHitRate = totalRequests > 0 ? (this.accessLog.hits / totalRequests) * 100 : 0;

    return {
      totalApps: Object.keys(this.cache).length,
      totalObjects,
      loadedObjects,
      memoryUsage,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      averageLoadTime: 0 // Would need to track timing data
    };
  }

  /**
   * Check if entry is valid (not expired and hash matches)
   */
  private isEntryValid(entry: LazyAppEntry, currentFileHash: string): boolean {
    const now = Date.now();
    
    if (now - entry.timestamp > this.maxAge) {
      return false;
    }

    if (entry.fileHash !== currentFileHash) {
      return false;
    }

    return true;
  }

  /**
   * Calculate approximate memory usage in MB
   */
  private calculateMemoryUsage(): number {
    let totalBytes = 0;
    
    for (const entry of Object.values(this.cache)) {
      // Rough estimation of memory usage
      totalBytes += entry.symbolsBuffer.length;
      totalBytes += JSON.stringify(entry.appData).length;
      totalBytes += JSON.stringify(entry.objectCache).length;
    }
    
    return Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
  }

  /**
   * Enforce memory limits using LRU eviction
   */
  private async enforceMemoryLimits(): Promise<void> {
    while (this.calculateMemoryUsage() > this.maxMemoryMB) {
      // Find least recently used entry
      let oldestEntry: string | null = null;
      let oldestTime = Date.now();

      for (const [filePath, entry] of Object.entries(this.cache)) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestEntry = filePath;
        }
      }

      if (oldestEntry) {
        delete this.cache[oldestEntry];
      } else {
        break; // Safety break
      }
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [filePath, entry] of Object.entries(this.cache)) {
      if (now - entry.timestamp > this.maxAge) {
        delete this.cache[filePath];
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache = {};
    this.accessLog = { hits: 0, misses: 0 };
  }

  /**
   * Get all cached app file paths
   */
  getCachedPaths(): string[] {
    return Object.keys(this.cache);
  }

  /**
   * Check if an app is cached
   */
  has(filePath: string, currentFileHash: string): boolean {
    const entry = this.cache[filePath];
    return entry ? this.isEntryValid(entry, currentFileHash) : false;
  }

  /**
   * Pre-load objects for better performance
   */
  async preloadObjects(
    filePath: string,
    currentFileHash: string,
    objectTypes: string[]
  ): Promise<void> {
    const entry = this.cache[filePath];
    
    if (!entry || !this.isEntryValid(entry, currentFileHash)) {
      return;
    }

    // Pre-load specified object types in background
    const preloadPromises = objectTypes.map(async (objectType) => {
      const cacheKey = `${objectType}:all`;
      if (!entry.objectCache[cacheKey]) {
        entry.objectCache[cacheKey] = await entry.streamingParser.loadObjectsByType(objectType);
      }
    });

    await Promise.all(preloadPromises);
  }
}