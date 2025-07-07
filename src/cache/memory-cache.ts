import { BCApp, AppCache } from '../types/bc-types.js';

export class MemoryCache {
  private cache: AppCache = {};
  private maxAge: number;

  constructor(maxAgeMinutes: number = 60) {
    this.maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Store an app in the cache
   */
  set(filePath: string, app: BCApp): void {
    this.cache[filePath] = {
      data: app,
      timestamp: Date.now(),
      fileHash: app.fileHash
    };
  }

  /**
   * Retrieve an app from the cache
   * Returns null if not found, expired, or file hash doesn't match
   */
  get(filePath: string, currentFileHash: string): BCApp | null {
    const entry = this.cache[filePath];
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      delete this.cache[filePath];
      return null;
    }

    // Check if file hash matches (file hasn't been modified)
    if (entry.fileHash !== currentFileHash) {
      delete this.cache[filePath];
      return null;
    }

    return entry.data;
  }

  /**
   * Check if an app is cached and valid
   */
  has(filePath: string, currentFileHash: string): boolean {
    return this.get(filePath, currentFileHash) !== null;
  }

  /**
   * Remove an app from the cache
   */
  delete(filePath: string): boolean {
    if (this.cache[filePath]) {
      delete this.cache[filePath];
      return true;
    }
    return false;
  }

  /**
   * Clear all cached apps
   */
  clear(): void {
    this.cache = {};
  }

  /**
   * Get all cached file paths
   */
  getCachedPaths(): string[] {
    return Object.keys(this.cache);
  }

  /**
   * Get all cached apps that are still valid
   */
  getValidCachedApps(): BCApp[] {
    const now = Date.now();
    const validApps: BCApp[] = [];

    for (const [filePath, entry] of Object.entries(this.cache)) {
      // Check if entry has expired
      if (now - entry.timestamp > this.maxAge) {
        delete this.cache[filePath];
        continue;
      }

      validApps.push(entry.data);
    }

    return validApps;
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
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    totalMemoryUsage: number;
  } {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    let totalMemoryUsage = 0;

    for (const entry of Object.values(this.cache)) {
      if (now - entry.timestamp > this.maxAge) {
        expiredEntries++;
      } else {
        validEntries++;
      }
      
      // Rough estimate of memory usage
      totalMemoryUsage += JSON.stringify(entry.data).length;
    }

    return {
      totalEntries: Object.keys(this.cache).length,
      validEntries,
      expiredEntries,
      totalMemoryUsage
    };
  }

  /**
   * Find cached apps by criteria
   */
  findApps(predicate: (app: BCApp) => boolean): BCApp[] {
    const validApps = this.getValidCachedApps();
    return validApps.filter(predicate);
  }

  /**
   * Find a cached app by app ID
   */
  findAppById(appId: string): BCApp | null {
    const validApps = this.getValidCachedApps();
    return validApps.find(app => app.id === appId) || null;
  }

  /**
   * Find cached apps by publisher
   */
  findAppsByPublisher(publisher: string): BCApp[] {
    return this.findApps(app => app.publisher === publisher);
  }

  /**
   * Find cached apps that depend on a specific app
   */
  findAppsDependingOn(targetAppId: string): BCApp[] {
    return this.findApps(app => 
      app.dependencies.some(dep => dep.id === targetAppId)
    );
  }

  /**
   * Get dependency tree for an app
   */
  getDependencyTree(appId: string): string[] {
    const app = this.findAppById(appId);
    if (!app) {
      return [];
    }

    const dependencies = new Set<string>();
    const visited = new Set<string>();

    const collectDependencies = (currentAppId: string) => {
      if (visited.has(currentAppId)) {
        return; // Avoid circular dependencies
      }
      
      visited.add(currentAppId);
      const currentApp = this.findAppById(currentAppId);
      
      if (currentApp) {
        for (const dep of currentApp.dependencies) {
          dependencies.add(dep.id);
          collectDependencies(dep.id);
        }
      }
    };

    collectDependencies(appId);
    return Array.from(dependencies);
  }

  /**
   * Get reverse dependency tree (apps that depend on this app)
   */
  getReverseDependencyTree(appId: string): string[] {
    const dependents = new Set<string>();
    const visited = new Set<string>();

    const collectDependents = (targetAppId: string) => {
      if (visited.has(targetAppId)) {
        return;
      }
      
      visited.add(targetAppId);
      const dependentApps = this.findAppsDependingOn(targetAppId);
      
      for (const app of dependentApps) {
        dependents.add(app.id);
        collectDependents(app.id);
      }
    };

    collectDependents(appId);
    return Array.from(dependents);
  }

  /**
   * Set cache expiration time
   */
  setMaxAge(maxAgeMinutes: number): void {
    this.maxAge = maxAgeMinutes * 60 * 1000;
  }

  /**
   * Check if cache is empty
   */
  isEmpty(): boolean {
    return Object.keys(this.cache).length === 0;
  }

  /**
   * Get cache size in entries
   */
  size(): number {
    return Object.keys(this.cache).length;
  }
}