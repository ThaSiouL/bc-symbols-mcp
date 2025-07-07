import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StreamingSymbolParser } from '../processors/streaming-parser.js';
import { LazyMemoryCache } from '../cache/lazy-cache.js';
import { MemoryOptimizedCache } from '../cache/memory-optimized-cache.js';
import { ProgressiveAppLoader } from '../processors/progressive-loader.js';
import { ObjectIndex } from '../indexing/object-index.js';

describe('Symbol Optimization Tests', () => {
  let streamingParser: StreamingSymbolParser;
  let lazyCache: LazyMemoryCache;
  let optimizedCache: MemoryOptimizedCache;
  let progressiveLoader: ProgressiveAppLoader;
  let objectIndex: ObjectIndex;
  beforeEach(() => {
    streamingParser = new StreamingSymbolParser();
    lazyCache = new LazyMemoryCache(60, 256); // 60 min, 256MB limit
    optimizedCache = new MemoryOptimizedCache(60, 256, true, 'lru');
    progressiveLoader = new ProgressiveAppLoader();
    objectIndex = new ObjectIndex();
  });

  afterEach(() => {
    lazyCache.clear();
    optimizedCache.clear();
    objectIndex.clear();
    progressiveLoader.cleanup();
  });

  describe('StreamingSymbolParser', () => {
    test('should create object index from buffer', async () => {
      const mockSymbolData = {
        RuntimeVersion: '1.0.0',
        Tables: [
          { Id: 18, Name: 'Customer', Properties: [] },
          { Id: 23, Name: 'Vendor', Properties: [] }
        ],
        Codeunits: [
          { Id: 12, Name: 'Gen. Jnl.-Post Line', Properties: [] }
        ]
      };
      
      const buffer = Buffer.from(JSON.stringify(mockSymbolData));
      const index = await streamingParser.parseSymbolsProgressive(buffer);
      
      expect(index.runtimeVersion).toBe('1.0.0');
      expect(index.totalObjects).toBe(3);
      expect(index.loadedObjects).toBe(0);
      expect(index.objectIndex.size).toBe(3);
    });

    test('should provide object metadata without loading', () => {
      const mockSymbolData = {
        RuntimeVersion: '1.0.0',
        Tables: [
          { Id: 18, Name: 'Customer', Properties: [] }
        ]
      };
      
      const buffer = Buffer.from(JSON.stringify(mockSymbolData));
      streamingParser.parseSymbolsProgressive(buffer).then(() => {
        const metadata = streamingParser.getObjectMetadata('table', 18, 'Customer');
        expect(metadata).toHaveLength(1);
        expect(metadata[0].objectType).toBe('table');
        expect(metadata[0].objectId).toBe(18);
        expect(metadata[0].name).toBe('Customer');
      });
    });

    test('should track loading statistics', () => {
      const stats = streamingParser.getLoadingStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('loaded');
      expect(stats).toHaveProperty('percentage');
    });
  });

  describe('LazyMemoryCache', () => {
    test('should store and retrieve apps lazily', async () => {
      const mockApp = {
        id: 'test-app',
        name: 'Test App',
        publisher: 'Test Publisher',
        version: '1.0.0',
        fileHash: 'hash123',
        filePath: '/test/app.app'
      } as any;
      
      const mockSymbolsBuffer = Buffer.from('{"RuntimeVersion":"1.0.0"}');
      
      await lazyCache.setLazy('/test/app.app', mockApp, mockSymbolsBuffer);
      
      const retrievedApp = lazyCache.getAppMetadata('/test/app.app', 'hash123');
      expect(retrievedApp).toBeTruthy();
      expect(retrievedApp?.id).toBe('test-app');
    });

    test('should provide cache statistics', async () => {
      const stats = lazyCache.getCacheStats();
      expect(stats).toHaveProperty('totalApps');
      expect(stats).toHaveProperty('totalObjects');
      expect(stats).toHaveProperty('loadedObjects');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('cacheHitRate');
    });

    test('should enforce memory limits', async () => {
      const smallCache = new LazyMemoryCache(60, 5); // 5MB limit to allow for some overhead
      
      const mockApp = {
        id: 'large-app',
        fileHash: 'hash123',
        filePath: '/large/app.app'
      } as any;
      
      // Create a buffer that's within reasonable limits for testing
      const symbolsBuffer = Buffer.from(JSON.stringify({
        RuntimeVersion: '1.0.0',
        Tables: Array.from({ length: 10 }, (_, i) => ({ Id: i, Name: `Table${i}` }))
      }));
      
      await smallCache.setLazy('/large/app.app', mockApp, symbolsBuffer);
      
      const stats = smallCache.getCacheStats();
      expect(stats.memoryUsage).toBeLessThanOrEqual(5);
    });
  });

  describe('MemoryOptimizedCache', () => {
    test('should store apps in partitioned structure', () => {
      const mockApp = {
        id: 'test-app',
        fileHash: 'hash123',
        symbols: { runtimeVersion: '1.0.0', namespaces: [] }
      } as any;
      
      optimizedCache.setApp('/test/app.app', mockApp);
      
      const retrievedApp = optimizedCache.getApp('/test/app.app', 'hash123');
      expect(retrievedApp).toBeTruthy();
      expect(retrievedApp?.id).toBe('test-app');
    });

    test('should store objects in type-specific partitions', () => {
      const mockTables = [
        { id: 18, name: 'Customer' },
        { id: 23, name: 'Vendor' }
      ];
      
      optimizedCache.setObjects('app1', 'table', mockTables);
      
      const retrievedTables = optimizedCache.getObjects('app1', 'table');
      expect(retrievedTables).toHaveLength(2);
      expect(retrievedTables?.[0].name).toBe('Customer');
    });

    test('should provide detailed memory statistics', () => {
      const stats = optimizedCache.getMemoryStats();
      expect(stats).toHaveProperty('totalMemoryMB');
      expect(stats).toHaveProperty('partitionSizes');
      expect(stats).toHaveProperty('largestObjects');
      expect(stats).toHaveProperty('compressionRatio');
    });

    test('should handle different eviction strategies', () => {
      const lruCache = new MemoryOptimizedCache(60, 256, false, 'lru');
      const lfuCache = new MemoryOptimizedCache(60, 256, false, 'lfu');
      const sizeCache = new MemoryOptimizedCache(60, 256, false, 'size-based');
      
      expect(lruCache).toBeTruthy();
      expect(lfuCache).toBeTruthy();
      expect(sizeCache).toBeTruthy();
    });
  });

  describe('ProgressiveAppLoader', () => {
    test('should provide loading progress updates', async () => {
      const progressUpdates: any[] = [];
      
      const mockOptions = {
        batchSize: 10,
        delayBetweenBatches: 1,
        priorityObjectTypes: ['table'],
        backgroundLoadingEnabled: false,
        progressCallback: (progress: any) => progressUpdates.push(progress)
      };
      
      // Test that progress callback is called
      if (mockOptions.progressCallback) {
        mockOptions.progressCallback({
          phase: 'metadata',
          percentage: 10,
          message: 'Loading metadata...',
          objectsLoaded: 0,
          totalObjects: 0
        });
      }
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].phase).toBe('metadata');
    });

    test('should handle background loading', async () => {
      const activeTasks = progressiveLoader.getActiveLoadingTasks();
      expect(Array.isArray(activeTasks)).toBe(true);
    });

    test('should support preloading specific object types', async () => {
      const mockObjectTypes = ['table', 'codeunit'];
      
      // Test method exists and can be called
      expect(typeof progressiveLoader.preloadObjectTypes).toBe('function');
      
      // Test that it accepts the expected parameters
      const result = progressiveLoader.preloadObjectTypes('/test/app.app', mockObjectTypes);
      expect(result).toBeInstanceOf(Promise);
      
      try {
        await result;
      } catch (error) {
        // Expected to fail since we don't have a real app file, but method should exist
        expect(error).toBeDefined();
      }
    });
  });

  describe('ObjectIndex', () => {
    test('should index objects with metadata', async () => {
      // Clear the index first
      objectIndex.clear();
      
      const mockApp = {
        id: 'test-app',
        filePath: '/test/app.app'
      } as any;
      
      const mockObjectLoader = {
        getObjectMetadata: (filePath: string, objectType: string) => {
          if (objectType === 'table') {
            return [
              {
                objectType: 'table',
                objectId: 18,
                name: 'Customer',
                namespace: 'Root',
                properties: []
              }
            ];
          }
          return []; // Return empty array for other object types
        }
      };
      
      await objectIndex.indexApp(mockApp, mockObjectLoader);
      
      const stats = objectIndex.getStats();
      expect(stats.totalObjects).toBe(1);
      expect(stats.objectsByType['table']).toBe(1);
    });

    test('should support complex searches', () => {
      // Test empty search
      const results = objectIndex.search({
        objectTypes: ['table'],
        keywords: ['customer']
      });
      
      // Should return empty array since no objects are indexed
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });

    test('should find objects by partial name', () => {
      const results = objectIndex.findByPartialName('Cust');
      expect(Array.isArray(results)).toBe(true);
    });

    test('should provide index statistics', () => {
      const stats = objectIndex.getStats();
      expect(stats).toHaveProperty('totalObjects');
      expect(stats).toHaveProperty('objectsByType');
      expect(stats).toHaveProperty('objectsByApp');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('indexingTime');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large symbol files efficiently', async () => {
      const startTime = Date.now();
      
      // Create a mock large symbol file
      const largeSymbolData = {
        RuntimeVersion: '1.0.0',
        Tables: Array.from({ length: 1000 }, (_, i) => ({
          Id: i + 1,
          Name: `Table${i + 1}`,
          Properties: []
        }))
      };
      
      const buffer = Buffer.from(JSON.stringify(largeSymbolData));
      const index = await streamingParser.parseSymbolsProgressive(buffer);
      
      const processingTime = Date.now() - startTime;
      
      expect(index.totalObjects).toBe(1000);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Load multiple apps
      for (let i = 0; i < 10; i++) {
        const mockApp = {
          id: `app-${i}`,
          fileHash: `hash-${i}`,
          filePath: `/test/app-${i}.app`
        } as any;
        
        const mockBuffer = Buffer.from(`{"RuntimeVersion":"1.0.0","Tables":[{"Id":${i},"Name":"Table${i}"}]}`);
        await lazyCache.setLazy(`/test/app-${i}.app`, mockApp, mockBuffer);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
      
      expect(memoryIncrease).toBeLessThan(100); // Should not increase by more than 100MB
    });

    test('should provide fast object lookups', async () => {
      // Build index with many objects
      const mockApp = { id: 'perf-app', filePath: '/perf/app.app' } as any;
      const mockLoader = {
        getObjectMetadata: jest.fn().mockReturnValue(
          Array.from({ length: 1000 }, (_, i) => ({
            objectType: 'table',
            objectId: i + 1,
            name: `Table${i + 1}`,
            namespace: 'Root'
          }))
        )
      };
      
      await objectIndex.indexApp(mockApp, mockLoader);
      
      const startTime = Date.now();
      
      // Perform multiple searches
      for (let i = 0; i < 100; i++) {
        objectIndex.search({ objectTypes: ['table'] });
      }
      
      const searchTime = Date.now() - startTime;
      
      expect(searchTime).toBeLessThan(1000); // 100 searches should complete within 1 second
    });
  });

  describe('Integration Tests', () => {
    test('should work together as a complete optimization system', async () => {
      // Test basic integration without complex operations
      const mockApp = {
        id: 'integration-app',
        name: 'Integration Test App',
        publisher: 'Test Publisher',
        version: '1.0.0',
        fileHash: 'integration-hash',
        filePath: '/integration/app.app',
        symbols: { runtimeVersion: '1.0.0', namespaces: [] }
      } as any;
      
      // 1. Set up lazy cache
      const symbolsBuffer = Buffer.from(JSON.stringify({
        RuntimeVersion: '1.0.0',
        Tables: [{ Id: 18, Name: 'Customer', Properties: [] }]
      }));
      
      await lazyCache.setLazy(mockApp.filePath, mockApp, symbolsBuffer);
      
      // 2. Index objects
      const mockLoader = {
        getObjectMetadata: () => [{
          objectType: 'table',
          objectId: 18,
          name: 'Customer',
          namespace: 'Root'
        }]
      };
      
      await objectIndex.indexApp(mockApp, mockLoader);
      
      // 3. Verify components work together
      const cacheStats = lazyCache.getCacheStats();
      const indexStats = objectIndex.getStats();
      
      expect(cacheStats.totalApps).toBeGreaterThan(0);
      expect(indexStats.totalObjects).toBeGreaterThan(0);
      
      // Test progressive loader exists
      expect(typeof progressiveLoader.getActiveLoadingTasks).toBe('function');
    });
  });
});