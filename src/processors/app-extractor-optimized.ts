import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { readFileSync } from 'fs';
import { BCApp } from '../types/bc-types.js';
import { LazyMemoryCache } from '../cache/lazy-cache.js';

export class OptimizedAppExtractor {
  private lazyCache: LazyMemoryCache;

  constructor(cache?: LazyMemoryCache) {
    this.lazyCache = cache || new LazyMemoryCache();
  }

  /**
   * Extract and process a Business Central .app file with lazy loading
   * @param filePath Path to the .app file
   * @returns Promise<BCApp> Processed app data with lazy-loaded symbols
   */
  async extractAppLazy(filePath: string): Promise<BCApp> {
    try {
      // Read the file and calculate hash
      const fileBuffer = readFileSync(filePath);
      const fileHash = this.calculateFileHash(fileBuffer);

      // Check if already cached
      const cachedApp = this.lazyCache.getAppMetadata(filePath, fileHash);
      if (cachedApp) {
        return cachedApp;
      }

      // Create ZIP instance with the file buffer
      const zipBuffer = fileBuffer.subarray(40); // Skip the 40-byte prefix
      const zip = new AdmZip(zipBuffer);
      
      // Extract required files
      const manifestXml = this.extractFileFromZip(zip, 'NavxManifest.xml');
      const symbolsJson = this.extractFileFromZip(zip, 'SymbolReference.json');
      
      if (!manifestXml || !symbolsJson) {
        throw new Error('Required files (NavxManifest.xml or SymbolReference.json) not found in .app file');
      }

      // Parse the manifest to get basic app info
      const manifest = await this.parseManifest(manifestXml);
      
      // Create minimal symbol reference (lazy loading will populate on demand)
      const symbols = {
        runtimeVersion: '',
        namespaces: []
      };

      // Create BCApp object
      const app: BCApp = {
        id: manifest.app.id,
        name: manifest.app.name,
        publisher: manifest.app.publisher,
        version: manifest.app.version,
        description: manifest.app.description,
        brief: manifest.app.brief,
        platform: manifest.app.platform,
        application: manifest.app.application,
        runtime: manifest.app.runtime,
        target: manifest.app.target,
        dependencies: manifest.dependencies,
        idRanges: manifest.idRanges,
        filePath,
        fileHash,
        manifest,
        symbols
      };

      // Store in lazy cache with symbol buffer for on-demand loading
      await this.lazyCache.setLazy(filePath, app, symbolsJson);

      return app;
    } catch (error) {
      throw new Error(`Failed to extract app from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load objects of specific type for an app
   */
  async loadObjectsByType(filePath: string, objectType: string): Promise<any[]> {
    const fileBuffer = readFileSync(filePath);
    const fileHash = this.calculateFileHash(fileBuffer);
    
    return await this.lazyCache.loadObjectsByType(filePath, fileHash, objectType);
  }

  /**
   * Load specific object for an app
   */
  async loadObject(
    filePath: string, 
    objectType: string, 
    objectId: number, 
    objectName: string
  ): Promise<any | null> {
    const fileBuffer = readFileSync(filePath);
    const fileHash = this.calculateFileHash(fileBuffer);
    
    return await this.lazyCache.loadObject(filePath, fileHash, objectType, objectId, objectName);
  }

  /**
   * Get object metadata without loading full objects
   */
  getObjectMetadata(
    filePath: string,
    objectType: string,
    objectId?: number,
    objectName?: string
  ): any[] {
    const fileBuffer = readFileSync(filePath);
    const fileHash = this.calculateFileHash(fileBuffer);
    
    return this.lazyCache.getObjectMetadata(filePath, fileHash, objectType, objectId, objectName);
  }

  /**
   * Get loading statistics for an app
   */
  getLoadingStats(filePath: string): any {
    const fileBuffer = readFileSync(filePath);
    const fileHash = this.calculateFileHash(fileBuffer);
    
    return this.lazyCache.getLoadingStats(filePath, fileHash);
  }

  /**
   * Pre-load commonly used object types for better performance
   */
  async preloadCommonObjects(filePath: string): Promise<void> {
    const fileBuffer = readFileSync(filePath);
    const fileHash = this.calculateFileHash(fileBuffer);
    
    // Pre-load tables and codeunits as they're commonly queried
    await this.lazyCache.preloadObjects(filePath, fileHash, ['table', 'codeunit']);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return this.lazyCache.getCacheStats();
  }

  /**
   * Calculate SHA-256 hash of file buffer
   */
  private calculateFileHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Extract a specific file from the ZIP archive
   */
  private extractFileFromZip(zip: AdmZip, fileName: string): Buffer | null {
    try {
      const entry = zip.getEntry(fileName);
      if (!entry) {
        return null;
      }
      return entry.getData();
    } catch (error) {
      console.warn(`Failed to extract ${fileName} from ZIP:`, error);
      return null;
    }
  }

  /**
   * Parse NavxManifest.xml content
   */
  private async parseManifest(manifestBuffer: Buffer): Promise<any> {
    const xml2js = await import('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    try {
      const result = await parser.parseStringPromise(manifestBuffer.toString('utf8'));
      return this.transformManifest(result);
    } catch (error) {
      throw new Error(`Failed to parse NavxManifest.xml: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transform parsed XML manifest to our BCManifest format
   */
  private transformManifest(xmlData: any): any {
    const packageData = xmlData.Package;
    const app = packageData.App;
    
    return {
      app: {
        id: app.$.Id,
        name: app.$.Name,
        publisher: app.$.Publisher,
        brief: app.$.Brief || '',
        description: app.$.Description || '',
        version: app.$.Version,
        compatibilityId: app.$.CompatibilityId || '0.0.0.0',
        privacyStatement: app.$.PrivacyStatement || '',
        eula: app.$.EULA || '',
        help: app.$.Help || '',
        helpBaseUrl: app.$.HelpBaseUrl || '',
        url: app.$.Url || '',
        logo: app.$.Logo || '',
        platform: app.$.Platform,
        application: app.$.Application,
        runtime: app.$.Runtime,
        target: app.$.Target,
        showMyCode: app.$.ShowMyCode === 'True'
      },
      idRanges: this.transformIdRanges(packageData.IdRanges),
      dependencies: this.transformDependencies(packageData.Dependencies),
      internalsVisibleTo: [],
      features: this.transformFeatures(packageData.Features),
      preprocessorSymbols: [],
      suppressWarnings: this.transformSuppressWarnings(packageData.SuppressWarnings),
      resourceExposurePolicy: this.transformResourceExposurePolicy(packageData.ResourceExposurePolicy),
      keyVaultUrls: [],
      build: this.transformBuildInfo(packageData.Build)
    };
  }

  private transformIdRanges(idRangesData: any): any[] {
    if (!idRangesData || !idRangesData.IdRange) {
      return [];
    }
    
    const ranges = Array.isArray(idRangesData.IdRange) ? idRangesData.IdRange : [idRangesData.IdRange];
    return ranges.map((range: any) => ({
      minObjectId: parseInt(range.$.MinObjectId, 10),
      maxObjectId: parseInt(range.$.MaxObjectId, 10)
    }));
  }

  private transformDependencies(dependenciesData: any): any[] {
    if (!dependenciesData || !dependenciesData.Dependency) {
      return [];
    }
    
    const deps = Array.isArray(dependenciesData.Dependency) ? dependenciesData.Dependency : [dependenciesData.Dependency];
    return deps.map((dep: any) => ({
      id: dep.$.Id,
      name: dep.$.Name,
      publisher: dep.$.Publisher,
      minVersion: dep.$.MinVersion,
      compatibilityId: dep.$.CompatibilityId || '0.0.0.0'
    }));
  }

  private transformFeatures(featuresData: any): string[] {
    if (!featuresData || !featuresData.Feature) {
      return [];
    }
    
    const features = Array.isArray(featuresData.Feature) ? featuresData.Feature : [featuresData.Feature];
    return features.map((feature: any) => typeof feature === 'string' ? feature : feature._);
  }

  private transformSuppressWarnings(suppressWarningsData: any): any[] {
    if (!suppressWarningsData || !suppressWarningsData.SuppressWarning) {
      return [];
    }
    
    const warnings = Array.isArray(suppressWarningsData.SuppressWarning) ? suppressWarningsData.SuppressWarning : [suppressWarningsData.SuppressWarning];
    return warnings.map((warning: any) => ({
      name: warning.$.Name
    }));
  }

  private transformResourceExposurePolicy(policyData: any): any {
    if (!policyData) {
      return {
        allowDebugging: false,
        allowDownloadingSource: false,
        includeSourceInSymbolFile: false,
        applyToDevExtension: false
      };
    }
    
    return {
      allowDebugging: policyData.$.AllowDebugging === 'true',
      allowDownloadingSource: policyData.$.AllowDownloadingSource === 'true',
      includeSourceInSymbolFile: policyData.$.IncludeSourceInSymbolFile === 'true',
      applyToDevExtension: policyData.$.ApplyToDevExtension === 'true'
    };
  }

  private transformBuildInfo(buildData: any): any {
    if (!buildData) {
      return {
        by: '',
        timestamp: '',
        compilerVersion: ''
      };
    }
    
    return {
      by: buildData.$.By || '',
      timestamp: buildData.$.Timestamp || '',
      compilerVersion: buildData.$.CompilerVersion || ''
    };
  }
}