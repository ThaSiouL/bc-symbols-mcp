import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import StreamValues from 'stream-json/streamers/StreamValues.js';
import parser from 'stream-json';
import { BCSymbolReference, BCNamespace } from '../types/bc-types.js';

const asyncPipeline = promisify(pipeline);

interface StreamingSymbolIndex {
  runtimeVersion: string;
  objectIndex: Map<string, ObjectMetadata>;
  totalObjects: number;
  loadedObjects: number;
}

interface ObjectMetadata {
  objectType: string;
  objectId: number;
  name: string;
  namespace: string;
  offset: number;
  size: number;
  loaded: boolean;
}

export class StreamingSymbolParser {
  private symbolIndex: StreamingSymbolIndex;
  private rawData: Buffer;
  
  constructor() {
    this.symbolIndex = {
      runtimeVersion: '',
      objectIndex: new Map(),
      totalObjects: 0,
      loadedObjects: 0
    };
    this.rawData = Buffer.alloc(0);
  }

  /**
   * Parse symbols with progressive loading - builds index first, loads objects on demand
   */
  async parseSymbolsProgressive(symbolsBuffer: Buffer): Promise<StreamingSymbolIndex> {
    this.rawData = symbolsBuffer;
    
    // Phase 1: Build object index by streaming through the JSON
    await this.buildObjectIndex(symbolsBuffer);
    
    return this.symbolIndex;
  }

  /**
   * Build a lightweight index of all objects without loading their full data
   */
  private async buildObjectIndex(buffer: Buffer): Promise<void> {
    try {
      // For now, use simple JSON parsing - streaming implementation can be enhanced later
      const jsonString = buffer.toString('utf8');
      const data = JSON.parse(jsonString);
      
      this.symbolIndex.runtimeVersion = data.RuntimeVersion || '';
      
      // Process different object types
      const objectTypes = ['Tables', 'Codeunits', 'Pages', 'PageExtensions', 'Reports', 'XmlPorts', 'Queries', 'EnumTypes'];
      
      for (const arrayKey of objectTypes) {
        if (data[arrayKey] && Array.isArray(data[arrayKey])) {
          const objectType = this.getObjectTypeFromPath([], arrayKey);
          
          for (const obj of data[arrayKey]) {
            const metadata = this.createObjectMetadata(obj, objectType, 'Root');
            if (metadata) {
              const indexKey = `${objectType}:${metadata.objectId}:${metadata.name}`;
              this.symbolIndex.objectIndex.set(indexKey, metadata);
              this.symbolIndex.totalObjects++;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error building object index:', error);
      // Fallback to empty index
      this.symbolIndex.runtimeVersion = '';
      this.symbolIndex.totalObjects = 0;
    }
  }

  /**
   * Load specific object on demand
   */
  async loadObject(objectType: string, objectId: number, objectName: string): Promise<any> {
    const indexKey = `${objectType}:${objectId}:${objectName}`;
    const metadata = this.symbolIndex.objectIndex.get(indexKey);
    
    if (!metadata) {
      throw new Error(`Object not found: ${indexKey}`);
    }
    
    if (metadata.loaded) {
      return metadata; // Return cached object
    }
    
    // Parse specific object from raw buffer using offset/size
    const objectData = await this.parseObjectAtOffset(metadata.offset, metadata.size);
    metadata.loaded = true;
    this.symbolIndex.loadedObjects++;
    
    return objectData;
  }

  /**
   * Load objects of a specific type on demand
   */
  async loadObjectsByType(objectType: string): Promise<any[]> {
    const objects: any[] = [];
    
    for (const [key, metadata] of this.symbolIndex.objectIndex) {
      if (metadata.objectType === objectType) {
        const object = await this.loadObject(metadata.objectType, metadata.objectId, metadata.name);
        objects.push(object);
      }
    }
    
    return objects;
  }

  /**
   * Get object metadata without loading full object
   */
  getObjectMetadata(objectType: string, objectId?: number, objectName?: string): ObjectMetadata[] {
    const results: ObjectMetadata[] = [];
    
    for (const metadata of this.symbolIndex.objectIndex.values()) {
      if (metadata.objectType === objectType) {
        if (objectId !== undefined && metadata.objectId !== objectId) continue;
        if (objectName !== undefined && metadata.name !== objectName) continue;
        results.push(metadata);
      }
    }
    
    return results;
  }

  /**
   * Get loading statistics
   */
  getLoadingStats(): { total: number; loaded: number; percentage: number } {
    const percentage = this.symbolIndex.totalObjects > 0 
      ? (this.symbolIndex.loadedObjects / this.symbolIndex.totalObjects) * 100 
      : 0;
      
    return {
      total: this.symbolIndex.totalObjects,
      loaded: this.symbolIndex.loadedObjects,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  /**
   * Create minimal compatible symbol reference for existing code
   */
  createLazySymbolReference(): BCSymbolReference {
    return {
      runtimeVersion: this.symbolIndex.runtimeVersion,
      namespaces: [this.createLazyNamespace()]
    };
  }

  private createLazyNamespace(): BCNamespace {
    return {
      name: 'Root',
      namespaces: [],
      tables: [],
      codeunits: [],
      pages: [],
      pageExtensions: [],
      reports: [],
      xmlPorts: [],
      queries: [],
      controlAddIns: [],
      enumTypes: [],
      dotNetPackages: [],
      interfaces: [],
      permissionSets: [],
      permissionSetExtensions: [],
      reportExtensions: []
    };
  }

  private isObjectArray(path: string[], key: string): boolean {
    const objectArrays = [
      'Tables', 'Codeunits', 'Pages', 'PageExtensions', 'Reports', 
      'XmlPorts', 'Queries', 'EnumTypes', 'ControlAddIns', 'Interfaces',
      'PermissionSets', 'PermissionSetExtensions', 'ReportExtensions'
    ];
    return objectArrays.includes(key);
  }

  private getObjectTypeFromPath(path: string[], key: string): string {
    const typeMap: { [key: string]: string } = {
      'Tables': 'table',
      'Codeunits': 'codeunit', 
      'Pages': 'page',
      'PageExtensions': 'pageextension',
      'Reports': 'report',
      'XmlPorts': 'xmlport',
      'Queries': 'query',
      'EnumTypes': 'enum',
      'ControlAddIns': 'controladdin',
      'Interfaces': 'interface',
      'PermissionSets': 'permissionset',
      'PermissionSetExtensions': 'permissionsetextension',
      'ReportExtensions': 'reportextension'
    };
    return typeMap[key] || 'unknown';
  }

  private createObjectMetadata(
    value: any, 
    objectType: string, 
    namespace: string
  ): ObjectMetadata | null {
    if (!value || typeof value !== 'object') return null;
    
    return {
      objectType,
      objectId: value.Id || 0,
      name: value.Name || '',
      namespace,
      offset: 0, // Will be calculated during actual parsing
      size: 0,   // Will be calculated during actual parsing  
      loaded: false
    };
  }

  private async parseObjectAtOffset(offset: number, size: number): Promise<any> {
    // Implementation would extract and parse specific JSON section
    // For now, return placeholder - full implementation would use
    // buffer slicing and targeted JSON parsing
    return {};
  }
}