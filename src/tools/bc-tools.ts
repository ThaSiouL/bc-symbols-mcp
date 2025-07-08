import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BCApp, ObjectQuery, DependencyQuery, ReferenceQuery } from '../types/bc-types.js';
import { AppExtractor } from '../processors/app-extractor.js';
import { SymbolParser } from '../processors/symbol-parser.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { readFileSync, existsSync } from 'fs';
import { stat, readdir } from 'fs/promises';
import { createHash } from 'crypto';
import { join, extname, resolve } from 'path';

export class BCTools {
  private cache: MemoryCache;
  private appExtractor: AppExtractor;
  private symbolParser: SymbolParser;
  private configuredSources: string[] = [];
  private discoveredFiles: string[] = [];

  constructor(cache: MemoryCache) {
    this.cache = cache;
    this.appExtractor = new AppExtractor();
    this.symbolParser = new SymbolParser();
  }

  /**
   * Get all available tools
   */
  getTools(): Tool[] {
    return [
      {
        name: 'load_app_file',
        description: 'Load and parse a Business Central .app file',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the .app file to load'
            }
          },
          required: ['filePath']
        }
      },
      {
        name: 'query_objects',
        description: 'Query BC objects by type, name, or ID across loaded apps',
        inputSchema: {
          type: 'object',
          properties: {
            appIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'App IDs to search in (optional, searches all if not specified)'
            },
            objectType: {
              type: 'string',
              description: 'Type of object to search for (table, page, codeunit, etc.)'
            },
            objectName: {
              type: 'string',
              description: 'Name of the object to find (optional)'
            },
            objectId: {
              type: 'number',
              description: 'ID of the object to find (optional)'
            },
            includeExtensions: {
              type: 'boolean',
              description: 'Include extension objects in results (default: true)'
            }
          }
        }
      },
      {
        name: 'analyze_dependencies',
        description: 'Analyze dependencies for a specific app',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'ID of the app to analyze'
            },
            includeTransitive: {
              type: 'boolean',
              description: 'Include transitive dependencies (default: true)'
            },
            direction: {
              type: 'string',
              enum: ['incoming', 'outgoing', 'both'],
              description: 'Direction of dependencies to analyze (default: both)'
            }
          },
          required: ['appId']
        }
      },
      {
        name: 'find_references',
        description: 'Find references to a specific object, field, or method',
        inputSchema: {
          type: 'object',
          properties: {
            appIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'App IDs to search in (optional, searches all if not specified)'
            },
            objectType: {
              type: 'string',
              description: 'Type of the target object'
            },
            objectName: {
              type: 'string',
              description: 'Name of the target object'
            },
            fieldName: {
              type: 'string',
              description: 'Name of the field to find references to (optional)'
            },
            methodName: {
              type: 'string',
              description: 'Name of the method to find references to (optional)'
            }
          },
          required: ['objectType', 'objectName']
        }
      },
      {
        name: 'get_object_details',
        description: 'Get detailed information about a specific BC object',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'App ID containing the object'
            },
            objectType: {
              type: 'string',
              description: 'Type of the object'
            },
            objectIdentifier: {
              type: 'string',
              description: 'Name or ID of the object'
            }
          },
          required: ['appId', 'objectType', 'objectIdentifier']
        }
      },
      {
        name: 'list_loaded_apps',
        description: 'List all loaded apps with their basic information',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_app_info',
        description: 'Get detailed information about a specific app',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'ID of the app'
            }
          },
          required: ['appId']
        }
      },
      {
        name: 'clear_cache',
        description: 'Clear the app cache',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'configure_app_sources',
        description: 'Configure app file paths and directories to analyze',
        inputSchema: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file paths or directory paths containing .app files'
            },
            autoLoad: {
              type: 'boolean',
              description: 'Automatically load discovered app files (default: true)'
            },
            recursive: {
              type: 'boolean',
              description: 'Scan subdirectories recursively (default: true)'
            },
            replace: {
              type: 'boolean',
              description: 'Replace existing configuration instead of appending (default: false)'
            }
          },
          required: ['paths']
        }
      },
      {
        name: 'get_app_sources',
        description: 'Get current app source configuration and discovered files',
        inputSchema: {
          type: 'object',
          properties: {
            rescan: {
              type: 'boolean',
              description: 'Rescan directories for app files (default: false)'
            }
          }
        }
      }
    ];
  }

  /**
   * Execute a tool
   */
  async executeTool(name: string, arguments_: any): Promise<any> {
    switch (name) {
      case 'load_app_file':
        return this.loadAppFile(arguments_.filePath);
      
      case 'query_objects':
        return this.queryObjects(arguments_);
      
      case 'analyze_dependencies':
        return this.analyzeDependencies(arguments_);
      
      case 'find_references':
        return this.findReferences(arguments_);
      
      case 'get_object_details':
        return this.getObjectDetails(arguments_.appId, arguments_.objectType, arguments_.objectIdentifier);
      
      case 'list_loaded_apps':
        return this.listLoadedApps();
      
      case 'get_app_info':
        return this.getAppInfo(arguments_.appId);
      
      case 'clear_cache':
        return this.clearCache();
      
      case 'configure_app_sources':
        return this.configureAppSources(arguments_);
      
      case 'get_app_sources':
        return this.getAppSources(arguments_);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Load an app file
   */
  private async loadAppFile(filePath: string): Promise<any> {
    try {
      // Calculate file hash to check cache
      const fileBuffer = readFileSync(filePath);
      const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

      // Check cache first
      const cachedApp = this.cache.get(filePath, fileHash);
      if (cachedApp) {
        return {
          success: true,
          message: 'App loaded from cache',
          app: {
            id: cachedApp.id,
            name: cachedApp.name,
            publisher: cachedApp.publisher,
            version: cachedApp.version,
            description: cachedApp.description,
            objectCounts: this.getObjectCounts(cachedApp)
          },
          cached: true
        };
      }

      // Extract and parse the app
      const app = await this.appExtractor.extractApp(filePath);
      
      // Store in cache
      this.cache.set(filePath, app);

      return {
        success: true,
        message: 'App loaded successfully',
        app: {
          id: app.id,
          name: app.name,
          publisher: app.publisher,
          version: app.version,
          description: app.description,
          platform: app.platform,
          application: app.application,
          runtime: app.runtime,
          target: app.target,
          dependencyCount: app.dependencies.length,
          objectCounts: this.getObjectCounts(app)
        },
        cached: false
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Query objects across apps
   */
  private async queryObjects(query: ObjectQuery): Promise<any> {
    try {
      const apps = query.appIds 
        ? query.appIds.map(id => this.cache.findAppById(id)).filter(app => app !== null) as BCApp[]
        : this.cache.getValidCachedApps();

      if (apps.length === 0) {
        return {
          success: false,
          error: 'No apps found or loaded'
        };
      }

      const results: any[] = [];

      for (const app of apps) {
        let objects: any[] = [];

        if (query.objectType) {
          objects = this.symbolParser.findObjectsByType(app.symbols, query.objectType);
        } else {
          // Get all object types if not specified
          const objectTypes = this.symbolParser.getAvailableObjectTypes(app.symbols);
          for (const type of objectTypes) {
            objects.push(...this.symbolParser.findObjectsByType(app.symbols, type).map(obj => ({ ...obj, objectType: type })));
          }
        }

        // Filter by name if specified
        if (query.objectName) {
          objects = objects.filter(obj => 
            obj.name.toLowerCase().includes(query.objectName!.toLowerCase())
          );
        }

        // Filter by ID if specified
        if (query.objectId !== undefined) {
          objects = objects.filter(obj => obj.id === query.objectId);
        }

        // Add app context to results
        for (const obj of objects) {
          results.push({
            app: {
              id: app.id,
              name: app.name,
              publisher: app.publisher,
              version: app.version
            },
            object: {
              id: obj.id,
              name: obj.name,
              type: query.objectType || obj.objectType,
              referenceSourceFileName: obj.referenceSourceFileName,
              fieldCount: obj.fields ? obj.fields.length : 0,
              methodCount: obj.methods ? obj.methods.length : 0,
              properties: obj.properties || []
            }
          });
        }
      }

      return {
        success: true,
        query,
        resultCount: results.length,
        results
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Analyze dependencies
   */
  private async analyzeDependencies(query: DependencyQuery): Promise<any> {
    try {
      const app = this.cache.findAppById(query.appId);
      if (!app) {
        return {
          success: false,
          error: `App not found: ${query.appId}`
        };
      }

      const result: any = {
        app: {
          id: app.id,
          name: app.name,
          publisher: app.publisher,
          version: app.version
        }
      };

      const direction = query.direction || 'both';
      const includeTransitive = query.includeTransitive !== false;

      if (direction === 'outgoing' || direction === 'both') {
        result.outgoingDependencies = {
          direct: app.dependencies,
          transitive: includeTransitive ? this.cache.getDependencyTree(app.id) : []
        };
      }

      if (direction === 'incoming' || direction === 'both') {
        const directDependents = this.cache.findAppsDependingOn(app.id);
        result.incomingDependencies = {
          direct: directDependents.map(depApp => ({
            id: depApp.id,
            name: depApp.name,
            publisher: depApp.publisher,
            version: depApp.version
          })),
          transitive: includeTransitive ? this.cache.getReverseDependencyTree(app.id) : []
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find references to an object/field/method
   */
  private async findReferences(query: ReferenceQuery): Promise<any> {
    try {
      const apps = query.appIds 
        ? query.appIds.map(id => this.cache.findAppById(id)).filter(app => app !== null) as BCApp[]
        : this.cache.getValidCachedApps();

      if (apps.length === 0) {
        return {
          success: false,
          error: 'No apps found or loaded'
        };
      }

      const references: any[] = [];

      // This is a simplified reference finder
      // In a full implementation, you would parse the actual AL source code
      for (const app of apps) {
        const allObjects = this.getAllObjects(app);
        
        for (const obj of allObjects) {
          // Check if this object references the target
          const hasReference = this.checkObjectReferences(obj, query);
          
          if (hasReference) {
            references.push({
              app: {
                id: app.id,
                name: app.name,
                publisher: app.publisher,
                version: app.version
              },
              referencingObject: {
                id: obj.id,
                name: obj.name,
                type: obj.objectType,
                referenceSourceFileName: obj.referenceSourceFileName
              },
              referenceType: this.determineReferenceType(obj, query)
            });
          }
        }
      }

      return {
        success: true,
        query,
        referenceCount: references.length,
        references
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get detailed object information
   */
  private async getObjectDetails(appId: string, objectType: string, objectIdentifier: string): Promise<any> {
    try {
      const app = this.cache.findAppById(appId);
      if (!app) {
        return {
          success: false,
          error: `App not found: ${appId}`
        };
      }

      // Try to find by name first, then by ID
      let object = this.symbolParser.findObjectByName(app.symbols, objectType, objectIdentifier);
      
      if (!object && !isNaN(Number(objectIdentifier))) {
        object = this.symbolParser.findObjectById(app.symbols, objectType, Number(objectIdentifier));
      }

      if (!object) {
        return {
          success: false,
          error: `Object not found: ${objectType} ${objectIdentifier} in app ${appId}`
        };
      }

      return {
        success: true,
        app: {
          id: app.id,
          name: app.name,
          publisher: app.publisher,
          version: app.version
        },
        object: {
          ...object,
          objectType
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all loaded apps
   */
  private async listLoadedApps(): Promise<any> {
    try {
      const apps = this.cache.getValidCachedApps();
      
      return {
        success: true,
        appCount: apps.length,
        apps: apps.map(app => ({
          id: app.id,
          name: app.name,
          publisher: app.publisher,
          version: app.version,
          description: app.description,
          platform: app.platform,
          runtime: app.runtime,
          target: app.target,
          filePath: app.filePath,
          dependencyCount: app.dependencies.length,
          objectCounts: this.getObjectCounts(app)
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get app information
   */
  private async getAppInfo(appId: string): Promise<any> {
    try {
      const app = this.cache.findAppById(appId);
      if (!app) {
        return {
          success: false,
          error: `App not found: ${appId}`
        };
      }

      return {
        success: true,
        app: {
          ...app,
          objectCounts: this.getObjectCounts(app),
          dependencyTree: this.cache.getDependencyTree(app.id),
          reverseDependencyTree: this.cache.getReverseDependencyTree(app.id)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear cache
   */
  private async clearCache(): Promise<any> {
    try {
      const stats = this.cache.getStats();
      this.cache.clear();
      
      return {
        success: true,
        message: 'Cache cleared successfully',
        previousStats: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Configure app sources
   */
  private async configureAppSources(args: {
    paths: string[];
    autoLoad?: boolean;
    recursive?: boolean;
    replace?: boolean;
  }): Promise<any> {
    try {
      const { paths, autoLoad = true, recursive = true, replace = false } = args;
      
      // Validate inputs
      if (!paths || paths.length === 0) {
        return {
          success: false,
          error: 'No paths provided'
        };
      }

      // Validate and resolve paths
      const validatedPaths: string[] = [];
      const invalidPaths: string[] = [];
      
      for (const path of paths) {
        const resolvedPath = resolve(path);
        if (existsSync(resolvedPath)) {
          validatedPaths.push(resolvedPath);
        } else {
          invalidPaths.push(path);
        }
      }

      if (invalidPaths.length > 0) {
        return {
          success: false,
          error: `Invalid paths: ${invalidPaths.join(', ')}`
        };
      }

      // Update configuration
      if (replace) {
        this.configuredSources = validatedPaths;
      } else {
        // Append new paths, avoiding duplicates
        for (const path of validatedPaths) {
          if (!this.configuredSources.includes(path)) {
            this.configuredSources.push(path);
          }
        }
      }

      // Scan for app files
      this.discoveredFiles = await this.scanForAppFiles(this.configuredSources, recursive);
      
      // Auto-load discovered apps if requested
      const loadResults: any[] = [];
      if (autoLoad) {
        for (const appFile of this.discoveredFiles) {
          try {
            const result = await this.loadAppFile(appFile);
            loadResults.push({
              file: appFile,
              result
            });
          } catch (error) {
            loadResults.push({
              file: appFile,
              result: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            });
          }
        }
      }

      return {
        success: true,
        message: 'App sources configured successfully',
        configuration: {
          configuredSources: this.configuredSources,
          discoveredFiles: this.discoveredFiles,
          fileCount: this.discoveredFiles.length
        },
        autoLoad: {
          enabled: autoLoad,
          results: loadResults,
          successCount: loadResults.filter(r => r.result.success).length,
          failureCount: loadResults.filter(r => !r.result.success).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get app sources
   */
  private async getAppSources(args: { rescan?: boolean } = {}): Promise<any> {
    try {
      const { rescan = false } = args;
      
      if (this.configuredSources.length > 0) {
        // Scan for app files if requested or if this is the first call
        if (rescan || this.discoveredFiles.length === 0) {
          this.discoveredFiles = await this.scanForAppFiles(this.configuredSources, true);
        }
      }
      
      // Get loaded apps information
      const loadedApps = this.cache.getValidCachedApps();
      const loadedFilePaths = loadedApps.map(app => app.filePath).filter(Boolean);
      
      // Categorize discovered files
      const categorizedFiles = {
        loaded: this.discoveredFiles.filter(file => loadedFilePaths.includes(file)),
        notLoaded: this.discoveredFiles.filter(file => !loadedFilePaths.includes(file))
      };
      
      return {
        success: true,
        configuration: {
          configuredSources: this.configuredSources,
          sourceCount: this.configuredSources.length
        },
        discoveredFiles: {
          files: this.discoveredFiles,
          totalCount: this.discoveredFiles.length,
          loaded: categorizedFiles.loaded,
          loadedCount: categorizedFiles.loaded.length,
          notLoaded: categorizedFiles.notLoaded,
          notLoadedCount: categorizedFiles.notLoaded.length
        },
        loadedApps: loadedApps.map(app => ({
          id: app.id,
          name: app.name,
          publisher: app.publisher,
          version: app.version,
          filePath: app.filePath
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Scan for app files in configured sources
   */
  private async scanForAppFiles(sources: string[], recursive: boolean): Promise<string[]> {
    const appFiles: string[] = [];
    
    const filePromises = sources.map(async (source) => {
      try {
        const stats = await stat(source);
        
        if (stats.isFile() && extname(source).toLowerCase() === '.app') {
          return [source];
        } else if (stats.isDirectory()) {
          return await this.scanDirectory(source, recursive);
        }
      } catch (error) {
        // Silently skip sources that can't be accessed
        return [];
      }
    });
    
    const results = await Promise.all(filePromises);
    const appFiles = results.flat();
    
    // Remove duplicates and sort
    return [...new Set(appFiles)].sort();
  }

  /**
   * Scan a directory for app files
   */
  private async scanDirectory(directory: string, recursive: boolean): Promise<string[]> {
    const appFiles: string[] = [];
    
    try {
      const entries = await readdir(directory);
      
      for (const entry of entries) {
        const fullPath = join(directory, entry);
        
        try {
          const stats = await stat(fullPath);
          
          if (stats.isFile() && extname(entry).toLowerCase() === '.app') {
            appFiles.push(fullPath);
          } else if (stats.isDirectory() && recursive) {
            const subdirectoryFiles = await this.scanDirectory(fullPath, recursive);
            appFiles.push(...subdirectoryFiles);
          }
        } catch (error) {
          // Silently skip files/directories that can't be accessed
        }
      }
    } catch (error) {
      // Silently skip directories that can't be read
    }
    
    return appFiles;
  }

  /**
   * Get configured app sources
   */
  getConfiguredSources(): string[] {
    return [...this.configuredSources];
  }

  /**
   * Helper: Get object counts for an app
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
   * Helper: Get all objects from an app
   */
  private getAllObjects(app: BCApp): any[] {
    const objects: any[] = [];
    const objectTypes = this.symbolParser.getAvailableObjectTypes(app.symbols);
    
    for (const objectType of objectTypes) {
      const typeObjects = this.symbolParser.findObjectsByType(app.symbols, objectType);
      objects.push(...typeObjects.map(obj => ({ ...obj, objectType })));
    }
    
    return objects;
  }

  /**
   * Helper: Check if an object references the target
   */
  private checkObjectReferences(obj: any, query: ReferenceQuery): boolean {
    // Simplified reference checking
    // In a full implementation, this would analyze the actual object structure
    
    // Check type definitions for references
    if (obj.fields) {
      for (const field of obj.fields) {
        if (this.typeDefinitionReferences(field.typeDefinition, query)) {
          return true;
        }
      }
    }

    if (obj.variables) {
      for (const variable of obj.variables) {
        if (this.typeDefinitionReferences(variable.typeDefinition, query)) {
          return true;
        }
      }
    }

    if (obj.methods) {
      for (const method of obj.methods) {
        if (method.parameters) {
          for (const param of method.parameters) {
            if (this.typeDefinitionReferences(param.typeDefinition, query)) {
              return true;
            }
          }
        }
        if (method.returnTypeDefinition && this.typeDefinitionReferences(method.returnTypeDefinition, query)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Helper: Check if a type definition references the target
   */
  private typeDefinitionReferences(typeDef: any, query: ReferenceQuery): boolean {
    if (!typeDef || !typeDef.subtype) {
      return false;
    }

    return typeDef.subtype.name === query.objectName;
  }

  /**
   * Helper: Determine reference type
   */
  private determineReferenceType(_obj: any, query: ReferenceQuery): string {
    // Simplified reference type determination
    if (query.fieldName) {
      return 'field_reference';
    } else if (query.methodName) {
      return 'method_reference';
    } else {
      return 'type_reference';
    }
  }
}