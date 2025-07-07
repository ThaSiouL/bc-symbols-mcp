import { EventEmitter } from 'events';
import { BCApp } from '../types/bc-types.js';
import { OptimizedAppExtractor } from './app-extractor-optimized.js';

interface LoadingProgress {
  phase: 'metadata' | 'manifest' | 'symbols' | 'objects' | 'complete';
  percentage: number;
  message: string;
  objectsLoaded: number;
  totalObjects: number;
  currentObjectType?: string;
  estimatedTimeRemaining?: number;
}

interface ProgressiveLoadingOptions {
  batchSize: number;
  delayBetweenBatches: number;
  priorityObjectTypes: string[];
  backgroundLoadingEnabled: boolean;
  progressCallback?: (progress: LoadingProgress) => void;
}

export class ProgressiveAppLoader extends EventEmitter {
  private extractor: OptimizedAppExtractor;
  private loadingTasks: Map<string, Promise<any>> = new Map();
  private loadingProgress: Map<string, LoadingProgress> = new Map();

  constructor(extractor?: OptimizedAppExtractor) {
    super();
    this.extractor = extractor || new OptimizedAppExtractor();
  }

  /**
   * Load app with progressive loading and progress reporting
   */
  async loadAppProgressive(
    filePath: string,
    options: Partial<ProgressiveLoadingOptions> = {}
  ): Promise<BCApp> {
    const defaultOptions: ProgressiveLoadingOptions = {
      batchSize: 50,
      delayBetweenBatches: 10,
      priorityObjectTypes: ['table', 'codeunit', 'page'],
      backgroundLoadingEnabled: true,
      ...options
    };

    const loadingId = `${filePath}-${Date.now()}`;
    
    try {
      // Phase 1: Load metadata and manifest
      this.updateProgress(loadingId, {
        phase: 'metadata',
        percentage: 10,
        message: 'Loading app metadata...',
        objectsLoaded: 0,
        totalObjects: 0
      }, defaultOptions.progressCallback);

      const app = await this.extractor.extractAppLazy(filePath);

      // Phase 2: Build object index
      this.updateProgress(loadingId, {
        phase: 'symbols',
        percentage: 25,
        message: 'Building object index...',
        objectsLoaded: 0,
        totalObjects: 0
      }, defaultOptions.progressCallback);

      const loadingStats = this.extractor.getLoadingStats(filePath);
      const totalObjects = loadingStats?.total || 0;

      // Phase 3: Progressive object loading
      this.updateProgress(loadingId, {
        phase: 'objects',
        percentage: 30,
        message: 'Loading objects progressively...',
        objectsLoaded: 0,
        totalObjects
      }, defaultOptions.progressCallback);

      if (defaultOptions.backgroundLoadingEnabled) {
        // Start background loading
        this.startBackgroundLoading(filePath, defaultOptions, loadingId);
      } else {
        // Load all objects synchronously
        await this.loadAllObjectsSync(filePath, defaultOptions, loadingId, totalObjects);
      }

      // Phase 4: Complete
      this.updateProgress(loadingId, {
        phase: 'complete',
        percentage: 100,
        message: 'Loading complete',
        objectsLoaded: totalObjects,
        totalObjects
      }, defaultOptions.progressCallback);

      return app;

    } catch (error) {
      this.emit('error', { loadingId, error });
      throw error;
    } finally {
      this.loadingProgress.delete(loadingId);
    }
  }

  /**
   * Start background loading of objects
   */
  private async startBackgroundLoading(
    filePath: string,
    options: ProgressiveLoadingOptions,
    loadingId: string
  ): Promise<void> {
    const taskId = `bg-${loadingId}`;
    
    const loadingTask = this.loadObjectsInBackground(filePath, options, loadingId);
    this.loadingTasks.set(taskId, loadingTask);

    // Don't await - let it run in background
    loadingTask.finally(() => {
      this.loadingTasks.delete(taskId);
    });
  }

  /**
   * Load objects in the background with progress updates
   */
  private async loadObjectsInBackground(
    filePath: string,
    options: ProgressiveLoadingOptions,
    loadingId: string
  ): Promise<void> {
    const startTime = Date.now();
    let loadedCount = 0;
    
    try {
      // Get all object metadata first
      const allMetadata = this.getAllObjectMetadata(filePath);
      const totalObjects = allMetadata.length;

      // Group by priority
      const priorityObjects = allMetadata.filter(meta => 
        options.priorityObjectTypes.includes(meta.objectType)
      );
      const otherObjects = allMetadata.filter(meta => 
        !options.priorityObjectTypes.includes(meta.objectType)
      );

      // Load priority objects first
      loadedCount += await this.loadObjectBatches(
        filePath, priorityObjects, options, loadingId, loadedCount, totalObjects, startTime
      );

      // Load remaining objects
      await this.loadObjectBatches(
        filePath, otherObjects, options, loadingId, loadedCount, totalObjects, startTime
      );

      this.emit('backgroundLoadingComplete', { filePath, loadingId });

    } catch (error) {
      this.emit('backgroundLoadingError', { filePath, loadingId, error });
    }
  }

  /**
   * Load objects in batches with delays
   */
  private async loadObjectBatches(
    filePath: string,
    objects: any[],
    options: ProgressiveLoadingOptions,
    loadingId: string,
    initialLoadedCount: number,
    totalObjects: number,
    startTime: number
  ): Promise<number> {
    let loadedCount = initialLoadedCount;
    
    for (let i = 0; i < objects.length; i += options.batchSize) {
      const batch = objects.slice(i, i + options.batchSize);
      const currentObjectType = batch[0]?.objectType;

      // Load batch
      const loadPromises = batch.map(meta =>
        this.extractor.loadObject(filePath, meta.objectType, meta.objectId, meta.name)
      );

      await Promise.all(loadPromises);
      loadedCount += batch.length;

      // Calculate progress and ETA
      const elapsedTime = Date.now() - startTime;
      const objectsPerMs = loadedCount / elapsedTime;
      const remainingObjects = totalObjects - loadedCount;
      const estimatedTimeRemaining = objectsPerMs > 0 ? remainingObjects / objectsPerMs : 0;

      // Update progress
      const percentage = 30 + (loadedCount / totalObjects) * 65; // 30-95% range
      this.updateProgress(loadingId, {
        phase: 'objects',
        percentage: Math.min(percentage, 95),
        message: `Loading ${currentObjectType} objects...`,
        objectsLoaded: loadedCount,
        totalObjects,
        currentObjectType,
        estimatedTimeRemaining
      }, options.progressCallback);

      // Emit batch completion event
      this.emit('batchLoaded', {
        filePath,
        loadingId,
        batchSize: batch.length,
        totalLoaded: loadedCount,
        totalObjects
      });

      // Add delay between batches to prevent blocking
      if (i + options.batchSize < objects.length && options.delayBetweenBatches > 0) {
        await this.delay(options.delayBetweenBatches);
      }
    }

    return loadedCount;
  }

  /**
   * Load all objects synchronously (for non-background mode)
   */
  private async loadAllObjectsSync(
    filePath: string,
    options: ProgressiveLoadingOptions,
    loadingId: string,
    totalObjects: number
  ): Promise<void> {
    const allMetadata = this.getAllObjectMetadata(filePath);
    await this.loadObjectBatches(filePath, allMetadata, options, loadingId, 0, totalObjects, Date.now());
  }

  /**
   * Get all object metadata for progressive loading
   */
  private getAllObjectMetadata(filePath: string): any[] {
    const objectTypes = ['table', 'codeunit', 'page', 'pageextension', 'report', 'enum'];
    const allMetadata: any[] = [];

    for (const objectType of objectTypes) {
      const metadata = this.extractor.getObjectMetadata(filePath, objectType);
      allMetadata.push(...metadata);
    }

    return allMetadata;
  }

  /**
   * Update loading progress
   */
  private updateProgress(
    loadingId: string,
    progress: LoadingProgress,
    callback?: (progress: LoadingProgress) => void
  ): void {
    this.loadingProgress.set(loadingId, progress);
    
    if (callback) {
      callback(progress);
    }
    
    this.emit('progress', { loadingId, progress });
  }

  /**
   * Get current loading progress
   */
  getLoadingProgress(loadingId: string): LoadingProgress | null {
    return this.loadingProgress.get(loadingId) || null;
  }

  /**
   * Get all active loading tasks
   */
  getActiveLoadingTasks(): string[] {
    return Array.from(this.loadingTasks.keys());
  }

  /**
   * Cancel background loading task
   */
  cancelBackgroundLoading(taskId: string): boolean {
    const task = this.loadingTasks.get(taskId);
    if (task) {
      this.loadingTasks.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Wait for specific loading task to complete
   */
  async waitForLoadingTask(taskId: string): Promise<any> {
    const task = this.loadingTasks.get(taskId);
    if (task) {
      return await task;
    }
    throw new Error(`Loading task ${taskId} not found`);
  }

  /**
   * Preload specific object types
   */
  async preloadObjectTypes(
    filePath: string,
    objectTypes: string[],
    progressCallback?: (progress: LoadingProgress) => void
  ): Promise<void> {
    const loadingId = `preload-${filePath}-${Date.now()}`;
    let totalLoaded = 0;
    let totalObjects = 0;

    // Calculate total objects to load
    for (const objectType of objectTypes) {
      const metadata = this.extractor.getObjectMetadata(filePath, objectType);
      totalObjects += metadata.length;
    }

    for (const objectType of objectTypes) {
      const metadata = this.extractor.getObjectMetadata(filePath, objectType);
      
      this.updateProgress(loadingId, {
        phase: 'objects',
        percentage: (totalLoaded / totalObjects) * 100,
        message: `Preloading ${objectType} objects...`,
        objectsLoaded: totalLoaded,
        totalObjects,
        currentObjectType: objectType
      }, progressCallback);

      await this.extractor.loadObjectsByType(filePath, objectType);
      totalLoaded += metadata.length;
    }

    this.updateProgress(loadingId, {
      phase: 'complete',
      percentage: 100,
      message: 'Preloading complete',
      objectsLoaded: totalObjects,
      totalObjects
    }, progressCallback);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return this.extractor.getCacheStats();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Cancel all active loading tasks
    for (const taskId of this.loadingTasks.keys()) {
      this.loadingTasks.delete(taskId);
    }
    
    this.loadingProgress.clear();
    this.removeAllListeners();
  }
}