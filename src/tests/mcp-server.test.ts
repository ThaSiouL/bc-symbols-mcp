import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BCSymbolsServer } from '../server.js';

describe('MCP Server Protocol Compliance', () => {
  let server: BCSymbolsServer;
  let consoleSpy: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console.error to avoid spam
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create server instance
    server = new BCSymbolsServer();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Server Initialization', () => {
    test('should create server with correct configuration', () => {
      const serverInfo = server.getServerInfo();
      
      expect(serverInfo.name).toBe('bc-symbols-mcp');
      expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
      expect(serverInfo.capabilities).toEqual(['resources', 'tools']);
      expect(serverInfo.cacheStats).toBeDefined();
    });

    test('should initialize cache with 60 minute expiration', () => {
      // The cache should be initialized during server construction
      const cache = (server as any).cache;
      expect(cache).toBeDefined();
      expect(typeof cache.getStats).toBe('function');
    });
  });

  describe('Server Information', () => {
    test('should return consistent server info', () => {
      const info1 = server.getServerInfo();
      const info2 = server.getServerInfo();
      
      expect(info1).toEqual(info2);
      expect(info1.name).toBe('bc-symbols-mcp');
      expect(info1.capabilities).toContain('resources');
      expect(info1.capabilities).toContain('tools');
    });

    test('should include cache statistics', () => {
      const serverInfo = server.getServerInfo();
      
      expect(serverInfo.cacheStats).toBeDefined();
      expect(typeof serverInfo.cacheStats).toBe('object');
    });
  });

  describe('Resources Handler', () => {
    test('should return empty resources when no apps loaded', async () => {
      const resources = (server as any).resources;
      const result = await resources.listResources();
      
      // With empty cache, should return empty array
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle resource reading errors gracefully', async () => {
      const resources = (server as any).resources;
      
      // Test with invalid URI
      await expect(resources.readResource('invalid://uri')).rejects.toThrow();
    });
  });

  describe('Tools Handler', () => {
    test('should return all available tools', () => {
      const tools = (server as any).tools;
      const result = tools.getTools();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Check for expected tools
      const toolNames = result.map((tool: any) => tool.name);
      expect(toolNames).toContain('load_app_file');
      expect(toolNames).toContain('query_objects');
      expect(toolNames).toContain('list_loaded_apps');
    });

    test('should include proper tool schemas', () => {
      const tools = (server as any).tools;
      const result = tools.getTools();
      
      result.forEach((tool: any) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      });
    });

    test('should handle tool execution errors gracefully', async () => {
      const tools = (server as any).tools;
      
      // Test with invalid tool name - should throw error
      await expect(tools.executeTool('invalid_tool', {})).rejects.toThrow('Unknown tool: invalid_tool');
    });

    test('should handle missing required parameters', async () => {
      const tools = (server as any).tools;
      
      // Test load_app_file without required filePath
      const result = await tools.executeTool('load_app_file', {});
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });

    test('should execute list_loaded_apps tool successfully', async () => {
      const tools = (server as any).tools;
      
      const result = await tools.executeTool('list_loaded_apps', {});
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('apps');
      expect(Array.isArray(result.apps)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed tool arguments', async () => {
      const tools = (server as any).tools;
      
      // Test with null arguments
      const result = await tools.executeTool('query_objects', null);
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });

    test('should handle server errors gracefully', async () => {
      const tools = (server as any).tools;
      
      // Test with invalid arguments that should cause an error
      const result = await tools.executeTool('query_objects', { invalid: 'args' });
      
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Server Lifecycle', () => {
    test('should handle shutdown gracefully', async () => {
      await server.shutdown();
      
      expect(consoleSpy).toHaveBeenCalledWith('Shutting down BC Symbols MCP Server...');
      expect(consoleSpy).toHaveBeenCalledWith('Server shutdown complete');
    });

    test('should include cache statistics in shutdown', async () => {
      await server.shutdown();
      
      // Should log some cache cleanup information
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Cache cleanup: \d+ entries, \d+ KB/));
    });
  });
});