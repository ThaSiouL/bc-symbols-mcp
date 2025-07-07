import { BCApp } from '../types/bc-types.js';

interface ObjectIndexEntry {
  appId: string;
  objectType: string;
  objectId: number;
  objectName: string;
  namespace: string;
  filePath: string;
  lastModified: number;
  properties: { [key: string]: string };
  dependencies: string[];
  keywords: string[];
}

interface SearchFilter {
  appIds?: string[];
  objectTypes?: string[];
  objectNames?: string[];
  objectIds?: number[];
  namespaces?: string[];
  keywords?: string[];
  properties?: { [key: string]: string };
  minId?: number;
  maxId?: number;
}

interface IndexStats {
  totalObjects: number;
  objectsByType: { [type: string]: number };
  objectsByApp: { [appId: string]: number };
  memoryUsage: number;
  indexingTime: number;
  lastUpdated: number;
}

export class ObjectIndex {
  private index: Map<string, ObjectIndexEntry> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private nameIndex: Map<string, Set<string>> = new Map();
  private appIndex: Map<string, Set<string>> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map();
  private dependencyIndex: Map<string, Set<string>> = new Map();
  
  private indexingStartTime: number = 0;
  private indexingEndTime: number = 0;

  /**
   * Index all objects from an app
   */
  async indexApp(app: BCApp, objectLoader: any): Promise<void> {
    this.indexingStartTime = Date.now();
    
    try {
      const objectTypes = ['table', 'codeunit', 'page', 'pageextension', 'report', 'enum'];
      
      for (const objectType of objectTypes) {
        const metadata = objectLoader.getObjectMetadata(app.filePath, objectType);
        
        for (const meta of metadata) {
          await this.indexObject(app, objectType, meta, objectLoader);
        }
      }
    } finally {
      this.indexingEndTime = Date.now();
    }
  }

  /**
   * Index a single object
   */
  private async indexObject(
    app: BCApp,
    objectType: string,
    metadata: any,
    objectLoader: any
  ): Promise<void> {
    const objectKey = this.createObjectKey(app.id, objectType, metadata.objectId, metadata.name);
    
    // Extract keywords for search
    const keywords = this.extractKeywords(metadata.name, objectType);
    
    // Get dependencies (this would need object details)
    const dependencies = await this.extractDependencies(app, objectType, metadata, objectLoader);
    
    const indexEntry: ObjectIndexEntry = {
      appId: app.id,
      objectType,
      objectId: metadata.objectId,
      objectName: metadata.name,
      namespace: metadata.namespace || 'Root',
      filePath: app.filePath,
      lastModified: Date.now(),
      properties: this.extractProperties(metadata),
      dependencies,
      keywords
    };

    // Add to main index
    this.index.set(objectKey, indexEntry);

    // Add to secondary indexes
    this.addToIndex(this.typeIndex, objectType, objectKey);
    this.addToIndex(this.nameIndex, metadata.name.toLowerCase(), objectKey);
    this.addToIndex(this.appIndex, app.id, objectKey);
    
    // Add keywords to keyword index
    for (const keyword of keywords) {
      this.addToIndex(this.keywordIndex, keyword.toLowerCase(), objectKey);
    }
    
    // Add dependencies to dependency index
    for (const dep of dependencies) {
      this.addToIndex(this.dependencyIndex, dep, objectKey);
    }
  }

  /**
   * Search objects using filters
   */
  search(filter: SearchFilter): ObjectIndexEntry[] {
    let candidates = new Set<string>(this.index.keys());

    // Filter by app IDs
    if (filter.appIds && filter.appIds.length > 0) {
      const appMatches = new Set<string>();
      for (const appId of filter.appIds) {
        const appObjects = this.appIndex.get(appId);
        if (appObjects) {
          appObjects.forEach(key => appMatches.add(key));
        }
      }
      candidates = this.intersectSets(candidates, appMatches);
    }

    // Filter by object types
    if (filter.objectTypes && filter.objectTypes.length > 0) {
      const typeMatches = new Set<string>();
      for (const objectType of filter.objectTypes) {
        const typeObjects = this.typeIndex.get(objectType);
        if (typeObjects) {
          typeObjects.forEach(key => typeMatches.add(key));
        }
      }
      candidates = this.intersectSets(candidates, typeMatches);
    }

    // Filter by object names
    if (filter.objectNames && filter.objectNames.length > 0) {
      const nameMatches = new Set<string>();
      for (const objectName of filter.objectNames) {
        const nameObjects = this.nameIndex.get(objectName.toLowerCase());
        if (nameObjects) {
          nameObjects.forEach(key => nameMatches.add(key));
        }
      }
      candidates = this.intersectSets(candidates, nameMatches);
    }

    // Filter by keywords
    if (filter.keywords && filter.keywords.length > 0) {
      const keywordMatches = new Set<string>();
      for (const keyword of filter.keywords) {
        const keywordObjects = this.keywordIndex.get(keyword.toLowerCase());
        if (keywordObjects) {
          keywordObjects.forEach(key => keywordMatches.add(key));
        }
      }
      candidates = this.intersectSets(candidates, keywordMatches);
    }

    // Convert to results and apply remaining filters
    const results: ObjectIndexEntry[] = [];
    
    for (const key of candidates) {
      const entry = this.index.get(key);
      if (!entry) continue;

      // Filter by object IDs
      if (filter.objectIds && filter.objectIds.length > 0) {
        if (!filter.objectIds.includes(entry.objectId)) continue;
      }

      // Filter by ID range
      if (filter.minId !== undefined && entry.objectId < filter.minId) continue;
      if (filter.maxId !== undefined && entry.objectId > filter.maxId) continue;

      // Filter by namespaces
      if (filter.namespaces && filter.namespaces.length > 0) {
        if (!filter.namespaces.includes(entry.namespace)) continue;
      }

      // Filter by properties
      if (filter.properties) {
        let propertyMatch = true;
        for (const [propKey, propValue] of Object.entries(filter.properties)) {
          if (entry.properties[propKey] !== propValue) {
            propertyMatch = false;
            break;
          }
        }
        if (!propertyMatch) continue;
      }

      results.push(entry);
    }

    return results.sort((a, b) => {
      // Sort by object type, then by ID, then by name
      if (a.objectType !== b.objectType) {
        return a.objectType.localeCompare(b.objectType);
      }
      if (a.objectId !== b.objectId) {
        return a.objectId - b.objectId;
      }
      return a.objectName.localeCompare(b.objectName);
    });
  }

  /**
   * Find objects that depend on a specific object
   */
  findDependents(appId: string, objectType: string, objectName: string): ObjectIndexEntry[] {
    const dependencyKey = `${appId}:${objectType}:${objectName}`;
    const dependentKeys = this.dependencyIndex.get(dependencyKey);
    
    if (!dependentKeys) {
      return [];
    }

    const results: ObjectIndexEntry[] = [];
    for (const key of dependentKeys) {
      const entry = this.index.get(key);
      if (entry) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Find objects by partial name match
   */
  findByPartialName(partialName: string): ObjectIndexEntry[] {
    const searchTerm = partialName.toLowerCase();
    const matches: ObjectIndexEntry[] = [];

    for (const [name, objectKeys] of this.nameIndex) {
      if (name.includes(searchTerm)) {
        for (const key of objectKeys) {
          const entry = this.index.get(key);
          if (entry) {
            matches.push(entry);
          }
        }
      }
    }

    return matches;
  }

  /**
   * Get object by exact match
   */
  getObject(appId: string, objectType: string, objectId: number, objectName: string): ObjectIndexEntry | null {
    const key = this.createObjectKey(appId, objectType, objectId, objectName);
    return this.index.get(key) || null;
  }

  /**
   * Get all objects of a specific type
   */
  getObjectsByType(objectType: string): ObjectIndexEntry[] {
    const objectKeys = this.typeIndex.get(objectType);
    if (!objectKeys) {
      return [];
    }

    const results: ObjectIndexEntry[] = [];
    for (const key of objectKeys) {
      const entry = this.index.get(key);
      if (entry) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get all objects from a specific app
   */
  getObjectsByApp(appId: string): ObjectIndexEntry[] {
    const objectKeys = this.appIndex.get(appId);
    if (!objectKeys) {
      return [];
    }

    const results: ObjectIndexEntry[] = [];
    for (const key of objectKeys) {
      const entry = this.index.get(key);
      if (entry) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    const objectsByType: { [type: string]: number } = {};
    const objectsByApp: { [appId: string]: number } = {};

    for (const entry of this.index.values()) {
      objectsByType[entry.objectType] = (objectsByType[entry.objectType] || 0) + 1;
      objectsByApp[entry.appId] = (objectsByApp[entry.appId] || 0) + 1;
    }

    return {
      totalObjects: this.index.size,
      objectsByType,
      objectsByApp,
      memoryUsage: this.calculateMemoryUsage(),
      indexingTime: this.indexingEndTime - this.indexingStartTime,
      lastUpdated: this.indexingEndTime
    };
  }

  /**
   * Remove objects from an app
   */
  removeApp(appId: string): void {
    const objectKeys = this.appIndex.get(appId);
    if (!objectKeys) {
      return;
    }

    for (const key of objectKeys) {
      const entry = this.index.get(key);
      if (entry) {
        // Remove from all indexes
        this.removeFromIndex(this.typeIndex, entry.objectType, key);
        this.removeFromIndex(this.nameIndex, entry.objectName.toLowerCase(), key);
        this.removeFromIndex(this.appIndex, entry.appId, key);
        
        for (const keyword of entry.keywords) {
          this.removeFromIndex(this.keywordIndex, keyword.toLowerCase(), key);
        }
        
        for (const dep of entry.dependencies) {
          this.removeFromIndex(this.dependencyIndex, dep, key);
        }
        
        this.index.delete(key);
      }
    }
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.index.clear();
    this.typeIndex.clear();
    this.nameIndex.clear();
    this.appIndex.clear();
    this.keywordIndex.clear();
    this.dependencyIndex.clear();
  }

  /**
   * Helper methods
   */
  private createObjectKey(appId: string, objectType: string, objectId: number, objectName: string): string {
    return `${appId}:${objectType}:${objectId}:${objectName}`;
  }

  private addToIndex(index: Map<string, Set<string>>, key: string, value: string): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  private removeFromIndex(index: Map<string, Set<string>>, key: string, value: string): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  private intersectSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of set1) {
      if (set2.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  private extractKeywords(objectName: string, objectType: string): string[] {
    const keywords = [objectType];
    
    // Split camelCase and PascalCase names
    const words = objectName.replace(/([A-Z])/g, ' $1').trim().split(' ');
    keywords.push(...words.map(w => w.toLowerCase()));
    
    // Add the full name
    keywords.push(objectName.toLowerCase());
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  private extractProperties(metadata: any): { [key: string]: string } {
    const properties: { [key: string]: string } = {};
    
    if (metadata.properties && Array.isArray(metadata.properties)) {
      for (const prop of metadata.properties) {
        if (prop.name && prop.value) {
          properties[prop.name] = prop.value;
        }
      }
    }
    
    return properties;
  }

  private async extractDependencies(
    app: BCApp,
    objectType: string,
    metadata: any,
    objectLoader: any
  ): Promise<string[]> {
    // This would require loading the full object to analyze dependencies
    // For now, return empty array - full implementation would parse object references
    return [];
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    // Estimate memory usage of main index
    for (const entry of this.index.values()) {
      totalSize += JSON.stringify(entry).length;
    }
    
    // Estimate memory usage of secondary indexes
    totalSize += JSON.stringify([...this.typeIndex.entries()]).length;
    totalSize += JSON.stringify([...this.nameIndex.entries()]).length;
    totalSize += JSON.stringify([...this.appIndex.entries()]).length;
    totalSize += JSON.stringify([...this.keywordIndex.entries()]).length;
    totalSize += JSON.stringify([...this.dependencyIndex.entries()]).length;
    
    return Math.round((totalSize / (1024 * 1024)) * 100) / 100; // MB
  }
}