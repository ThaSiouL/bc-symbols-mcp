import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { BCApp } from '../types/bc-types.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { SymbolParser } from '../processors/symbol-parser.js';

export class BCResources {
  private cache: MemoryCache;
  private symbolParser: SymbolParser;

  constructor(cache: MemoryCache) {
    this.cache = cache;
    this.symbolParser = new SymbolParser();
  }

  /**
   * List all available resources
   */
  async listResources(): Promise<Resource[]> {
    const apps = this.cache.getValidCachedApps();
    const resources: Resource[] = [];

    for (const app of apps) {
      // App manifest resource
      resources.push({
        uri: `bc-app://${app.id}/manifest`,
        name: `${app.name} - Manifest`,
        description: `Manifest data for ${app.name} (${app.publisher})`,
        mimeType: 'application/json'
      });

      // App symbols resource
      resources.push({
        uri: `bc-app://${app.id}/symbols`,
        name: `${app.name} - Symbols`,
        description: `Symbol reference data for ${app.name} (${app.publisher})`,
        mimeType: 'application/json'
      });

      // Object type resources
      const objectTypes = this.symbolParser.getAvailableObjectTypes(app.symbols);
      for (const objectType of objectTypes) {
        resources.push({
          uri: `bc-app://${app.id}/objects/${objectType}`,
          name: `${app.name} - ${objectType} Objects`,
          description: `All ${objectType} objects in ${app.name}`,
          mimeType: 'application/json'
        });
      }

      // App info resource
      resources.push({
        uri: `bc-app://${app.id}/info`,
        name: `${app.name} - App Info`,
        description: `Basic information about ${app.name}`,
        mimeType: 'application/json'
      });

      // Dependencies resource
      resources.push({
        uri: `bc-app://${app.id}/dependencies`,
        name: `${app.name} - Dependencies`,
        description: `Dependency information for ${app.name}`,
        mimeType: 'application/json'
      });
    }

    // Global resources
    resources.push({
      uri: 'bc-apps://all',
      name: 'All Loaded Apps',
      description: 'List of all loaded BC apps',
      mimeType: 'application/json'
    });

    resources.push({
      uri: 'bc-apps://cache-stats',
      name: 'Cache Statistics',
      description: 'Current cache statistics and memory usage',
      mimeType: 'application/json'
    });

    return resources;
  }

  /**
   * Read a specific resource
   */
  async readResource(uri: string): Promise<string> {
    const url = new URL(uri);
    
    if (url.protocol === 'bc-app:') {
      return this.readAppResource(url);
    } else if (url.protocol === 'bc-apps:') {
      return this.readGlobalResource(url);
    } else {
      throw new Error(`Unsupported URI protocol: ${url.protocol}`);
    }
  }

  /**
   * Read app-specific resource
   */
  private async readAppResource(url: URL): Promise<string> {
    const pathParts = url.pathname.split('/').filter(p => p);
    
    if (pathParts.length < 2) {
      throw new Error(`Invalid app resource URI: ${url.toString()}`);
    }

    const appId = pathParts[0];
    const resourceType = pathParts[1];
    const resourceSubType = pathParts[2];

    const app = this.cache.findAppById(appId);
    if (!app) {
      throw new Error(`App not found: ${appId}`);
    }

    switch (resourceType) {
      case 'manifest':
        return JSON.stringify(app.manifest, null, 2);

      case 'symbols':
        return JSON.stringify(app.symbols, null, 2);

      case 'objects':
        if (!resourceSubType) {
          throw new Error('Object type not specified');
        }
        return this.getObjectsByType(app, resourceSubType);

      case 'info':
        return JSON.stringify({
          id: app.id,
          name: app.name,
          publisher: app.publisher,
          version: app.version,
          description: app.description,
          brief: app.brief,
          platform: app.platform,
          application: app.application,
          runtime: app.runtime,
          target: app.target,
          filePath: app.filePath,
          fileHash: app.fileHash,
          idRanges: app.idRanges
        }, null, 2);

      case 'dependencies':
        return JSON.stringify({
          directDependencies: app.dependencies,
          dependencyTree: this.cache.getDependencyTree(app.id),
          reverseDependencies: this.cache.getReverseDependencyTree(app.id)
        }, null, 2);

      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Read global resource
   */
  private async readGlobalResource(url: URL): Promise<string> {
    const resourceType = url.pathname.substring(1); // Remove leading slash

    switch (resourceType) {
      case 'all':
        const apps = this.cache.getValidCachedApps();
        return JSON.stringify(apps.map(app => ({
          id: app.id,
          name: app.name,
          publisher: app.publisher,
          version: app.version,
          description: app.description,
          filePath: app.filePath,
          dependencyCount: app.dependencies.length,
          objectCounts: this.getObjectCounts(app)
        })), null, 2);

      case 'cache-stats':
        return JSON.stringify(this.cache.getStats(), null, 2);

      default:
        throw new Error(`Unknown global resource: ${resourceType}`);
    }
  }

  /**
   * Get objects by type for an app
   */
  private getObjectsByType(app: BCApp, objectType: string): string {
    const objects = this.symbolParser.findObjectsByType(app.symbols, objectType);
    
    // Return simplified object information for better readability
    const simplifiedObjects = objects.map(obj => ({
      id: obj.id,
      name: obj.name,
      referenceSourceFileName: obj.referenceSourceFileName,
      properties: obj.properties,
      fieldCount: obj.fields ? obj.fields.length : 0,
      methodCount: obj.methods ? obj.methods.length : 0,
      variableCount: obj.variables ? obj.variables.length : 0
    }));

    return JSON.stringify(simplifiedObjects, null, 2);
  }

  /**
   * Get object counts for an app
   */
  private getObjectCounts(app: BCApp): { [objectType: string]: number } {
    const counts: { [objectType: string]: number } = {};
    const objectTypes = this.symbolParser.getAvailableObjectTypes(app.symbols);
    
    for (const objectType of objectTypes) {
      const objects = this.symbolParser.findObjectsByType(app.symbols, objectType);
      counts[objectType] = objects.length;
    }
    
    return counts;
  }

  /**
   * Search resources by query
   */
  async searchResources(query: string): Promise<Resource[]> {
    const allResources = await this.listResources();
    const lowerQuery = query.toLowerCase();
    
    return allResources.filter(resource => 
      resource.name.toLowerCase().includes(lowerQuery) ||
      resource.description?.toLowerCase().includes(lowerQuery) ||
      resource.uri.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get resource URI patterns
   */
  getResourcePatterns(): string[] {
    return [
      'bc-app://{appId}/manifest',
      'bc-app://{appId}/symbols',
      'bc-app://{appId}/objects/{objectType}',
      'bc-app://{appId}/info',
      'bc-app://{appId}/dependencies',
      'bc-apps://all',
      'bc-apps://cache-stats'
    ];
  }

  /**
   * Validate resource URI
   */
  validateResourceUri(uri: string): boolean {
    try {
      const url = new URL(uri);
      
      if (url.protocol === 'bc-app:') {
        const pathParts = url.pathname.split('/').filter(p => p);
        return pathParts.length >= 2;
      } else if (url.protocol === 'bc-apps:') {
        const resourceType = url.pathname.substring(1);
        return ['all', 'cache-stats'].includes(resourceType);
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get resource metadata
   */
  async getResourceMetadata(uri: string): Promise<{
    size: number;
    lastModified: Date;
    appInfo?: {
      id: string;
      name: string;
      version: string;
    };
  }> {
    const content = await this.readResource(uri);
    const url = new URL(uri);
    
    const metadata = {
      size: Buffer.byteLength(content, 'utf8'),
      lastModified: new Date()
    };

    if (url.protocol === 'bc-app:') {
      const appId = url.pathname.split('/')[1];
      const app = this.cache.findAppById(appId);
      if (app) {
        return {
          ...metadata,
          appInfo: {
            id: app.id,
            name: app.name,
            version: app.version
          }
        };
      }
    }

    return metadata;
  }
}