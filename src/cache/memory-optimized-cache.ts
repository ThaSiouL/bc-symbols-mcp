import { BCApp, CacheEntry } from '../types/bc-types.js';

interface PartitionedCacheEntry {
  appData: BCApp;
  timestamp: number;
  fileHash: string;
  accessCount: number;
  lastAccessed: number;
  memoryUsage: number;
}

interface ObjectTypePartition {
  [objectKey: string]: any;
}

interface CachePartitions {
  apps: { [filePath: string]: PartitionedCacheEntry };
  tables: ObjectTypePartition;
  codeunits: ObjectTypePartition;
  pages: ObjectTypePartition;
  pageExtensions: ObjectTypePartition;
  reports: ObjectTypePartition;
  enums: ObjectTypePartition;
  others: ObjectTypePartition;
}

interface MemoryStats {
  totalMemoryMB: number;
  partitionSizes: { [partition: string]: number };
  largestObjects: Array<{ key: string; sizeMB: number }>;
  compressionRatio: number;
}

export class MemoryOptimizedCache {
  private cache: CachePartitions;
  private maxAge: number;
  private maxMemoryMB: number;
  private compressionEnabled: boolean;
  private evictionStrategy: 'lru' | 'lfu' | 'size-based';

  constructor(
    maxAgeMinutes: number = 60,
    maxMemoryMB: number = 512,
    compressionEnabled: boolean = true,
    evictionStrategy: 'lru' | 'lfu' | 'size-based' = 'lru'
  ) {
    this.maxAge = maxAgeMinutes * 60 * 1000;
    this.maxMemoryMB = maxMemoryMB;
    this.compressionEnabled = compressionEnabled;
    this.evictionStrategy = evictionStrategy;
    
    this.cache = {
      apps: {},
      tables: {},
      codeunits: {},
      pages: {},
      pageExtensions: {},
      reports: {},
      enums: {},
      others: {}
    };
  }

  /**
   * Store app with memory optimization
   */
  setApp(filePath: string, app: BCApp): void {
    // Optimize app data before storing
    const optimizedApp = this.optimizeAppData(app);
    const memoryUsage = this.calculateObjectMemoryUsage(optimizedApp);

    this.cache.apps[filePath] = {
      appData: optimizedApp,
      timestamp: Date.now(),
      fileHash: app.fileHash,
      accessCount: 0,
      lastAccessed: Date.now(),
      memoryUsage
    };

    this.enforceMemoryLimits();
  }

  /**
   * Store objects in type-specific partitions
   */
  setObjects(appId: string, objectType: string, objects: any[]): void {
    const partition = this.getPartitionForType(objectType);
    const key = `${appId}:${objectType}`;
    
    // Optimize objects before storing
    const optimizedObjects = this.optimizeObjectsData(objects);
    
    if (this.compressionEnabled) {
      partition[key] = this.compressData(optimizedObjects);
    } else {
      partition[key] = optimizedObjects;
    }

    this.enforceMemoryLimits();
  }

  /**
   * Get app with memory tracking
   */
  getApp(filePath: string, currentFileHash: string): BCApp | null {
    const entry = this.cache.apps[filePath];
    
    if (!entry || !this.isEntryValid(entry.timestamp, entry.fileHash, currentFileHash)) {
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    return entry.appData;
  }

  /**
   * Get objects from type-specific partition
   */
  getObjects(appId: string, objectType: string): any[] | null {
    const partition = this.getPartitionForType(objectType);
    const key = `${appId}:${objectType}`;
    const data = partition[key];
    
    if (!data) {
      return null;
    }

    if (this.compressionEnabled && this.isCompressed(data)) {
      return this.decompressData(data);
    }
    
    return data;
  }

  /**
   * Get memory statistics with detailed breakdown
   */
  getMemoryStats(): MemoryStats {
    const stats: MemoryStats = {
      totalMemoryMB: 0,
      partitionSizes: {},
      largestObjects: [],
      compressionRatio: 1
    };

    // Calculate partition sizes
    for (const [partitionName, partition] of Object.entries(this.cache)) {
      if (partitionName === 'apps') {
        const appsPartition = partition as { [key: string]: PartitionedCacheEntry };
        const partitionSize = Object.values(appsPartition).reduce(
          (sum, entry) => sum + entry.memoryUsage, 0
        );
        stats.partitionSizes[partitionName] = Math.round(partitionSize * 100) / 100;
        stats.totalMemoryMB += partitionSize;
      } else {
        const objectPartition = partition as ObjectTypePartition;
        const partitionSize = this.calculatePartitionMemoryUsage(objectPartition);
        stats.partitionSizes[partitionName] = Math.round(partitionSize * 100) / 100;
        stats.totalMemoryMB += partitionSize;
      }
    }

    stats.totalMemoryMB = Math.round(stats.totalMemoryMB * 100) / 100;

    // Find largest objects
    stats.largestObjects = this.findLargestObjects().slice(0, 10);

    // Calculate compression ratio if enabled
    if (this.compressionEnabled) {
      stats.compressionRatio = this.calculateCompressionRatio();
    }

    return stats;
  }

  /**
   * Optimize memory usage by removing redundant data
   */
  private optimizeAppData(app: BCApp): BCApp {
    // Create optimized copy with minimal symbol data
    return {
      ...app,
      symbols: {
        runtimeVersion: app.symbols?.runtimeVersion || '',
        namespaces: [] // Symbols loaded separately
      }
    };
  }

  /**
   * Optimize objects data by removing unnecessary properties
   */
  private optimizeObjectsData(objects: any[]): any[] {
    return objects.map(obj => {
      // Remove empty arrays and undefined properties
      const optimized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              optimized[key] = value;
            }
          } else if (typeof value === 'object') {
            const optimizedNested = this.optimizeObjectsData([value])[0];
            if (Object.keys(optimizedNested).length > 0) {
              optimized[key] = optimizedNested;
            }
          } else {
            optimized[key] = value;
          }
        }
      }
      
      return optimized;
    });
  }

  /**
   * Get appropriate partition for object type
   */
  private getPartitionForType(objectType: string): ObjectTypePartition {
    switch (objectType.toLowerCase()) {
      case 'table':
      case 'tableextension':
        return this.cache.tables;
      case 'codeunit':
        return this.cache.codeunits;
      case 'page':
        return this.cache.pages;
      case 'pageextension':
        return this.cache.pageExtensions;
      case 'report':
      case 'reportextension':
        return this.cache.reports;
      case 'enum':
        return this.cache.enums;
      default:
        return this.cache.others;
    }
  }

  /**
   * Calculate memory usage of an object in MB
   */
  private calculateObjectMemoryUsage(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return jsonString.length / (1024 * 1024);
  }

  /**
   * Calculate memory usage of a partition
   */
  private calculatePartitionMemoryUsage(partition: ObjectTypePartition): number {
    let totalSize = 0;
    
    for (const data of Object.values(partition)) {
      totalSize += this.calculateObjectMemoryUsage(data);
    }
    
    return totalSize;
  }

  /**
   * Find largest objects across all partitions
   */
  private findLargestObjects(): Array<{ key: string; sizeMB: number }> {
    const largestObjects: Array<{ key: string; sizeMB: number }> = [];

    // Check all partitions
    for (const [partitionName, partition] of Object.entries(this.cache)) {
      if (partitionName === 'apps') {
        const appsPartition = partition as { [key: string]: PartitionedCacheEntry };
        for (const [key, entry] of Object.entries(appsPartition)) {
          largestObjects.push({
            key: `apps:${key}`,
            sizeMB: entry.memoryUsage
          });
        }
      } else {
        const objectPartition = partition as ObjectTypePartition;
        for (const [key, data] of Object.entries(objectPartition)) {
          largestObjects.push({
            key: `${partitionName}:${key}`,
            sizeMB: this.calculateObjectMemoryUsage(data)
          });
        }
      }
    }

    return largestObjects.sort((a, b) => b.sizeMB - a.sizeMB);
  }

  /**
   * Enforce memory limits using configured eviction strategy
   */
  private enforceMemoryLimits(): void {
    const currentMemory = this.getMemoryStats().totalMemoryMB;
    
    if (currentMemory <= this.maxMemoryMB) {
      return;
    }

    switch (this.evictionStrategy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'lfu':
        this.evictLFU();
        break;
      case 'size-based':
        this.evictLargest();
        break;
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    const allEntries = Object.entries(this.cache.apps).map(([key, entry]) => ({
      key,
      lastAccessed: entry.lastAccessed,
      type: 'app'
    }));

    allEntries.sort((a, b) => a.lastAccessed - b.lastAccessed);

    for (const entry of allEntries) {
      if (entry.type === 'app') {
        delete this.cache.apps[entry.key];
      }
      
      if (this.getMemoryStats().totalMemoryMB <= this.maxMemoryMB) {
        break;
      }
    }
  }

  /**
   * Evict least frequently used entries
   */
  private evictLFU(): void {
    const allEntries = Object.entries(this.cache.apps).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      type: 'app'
    }));

    allEntries.sort((a, b) => a.accessCount - b.accessCount);

    for (const entry of allEntries) {
      if (entry.type === 'app') {
        delete this.cache.apps[entry.key];
      }
      
      if (this.getMemoryStats().totalMemoryMB <= this.maxMemoryMB) {
        break;
      }
    }
  }

  /**
   * Evict largest entries first
   */
  private evictLargest(): void {
    const largestObjects = this.findLargestObjects();

    for (const obj of largestObjects) {
      const [partitionName, ...keyParts] = obj.key.split(':');
      const key = keyParts.join(':');
      
      if (partitionName === 'apps') {
        delete this.cache.apps[key];
      } else {
        const partition = this.getPartitionForType(partitionName);
        delete partition[key];
      }
      
      if (this.getMemoryStats().totalMemoryMB <= this.maxMemoryMB) {
        break;
      }
    }
  }

  /**
   * Check if entry is valid
   */
  private isEntryValid(timestamp: number, entryHash: string, currentHash: string): boolean {
    const now = Date.now();
    
    if (now - timestamp > this.maxAge) {
      return false;
    }

    if (entryHash !== currentHash) {
      return false;
    }

    return true;
  }

  /**
   * Simple compression placeholder
   */
  private compressData(data: any): any {
    // In a real implementation, use a compression library like zlib
    return { _compressed: true, data: JSON.stringify(data) };
  }

  /**
   * Simple decompression placeholder
   */
  private decompressData(compressedData: any): any {
    if (compressedData._compressed) {
      return JSON.parse(compressedData.data);
    }
    return compressedData;
  }

  /**
   * Check if data is compressed
   */
  private isCompressed(data: any): boolean {
    return data && typeof data === 'object' && data._compressed === true;
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(): number {
    // Placeholder implementation
    return 0.7; // Assume 30% compression
  }

  /**
   * Clear all cache data
   */
  clear(): void {
    this.cache = {
      apps: {},
      tables: {},
      codeunits: {},
      pages: {},
      pageExtensions: {},
      reports: {},
      enums: {},
      others: {}
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    // Clean up apps
    for (const [key, entry] of Object.entries(this.cache.apps)) {
      if (now - entry.timestamp > this.maxAge) {
        delete this.cache.apps[key];
        removedCount++;
      }
    }

    return removedCount;
  }
}