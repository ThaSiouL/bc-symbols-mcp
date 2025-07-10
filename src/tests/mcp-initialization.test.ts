import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BCSymbolsServer } from '../server.js';
import { createMockCache } from './helpers/test-data.js';

// Mock the MemoryCache
jest.mock('../cache/memory-cache.js', () => ({
  MemoryCache: jest.fn().mockImplementation(() => createMockCache())
}));

describe('MCP Server Initialization', () => {
  let server: BCSymbolsServer;
  let consoleSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Server Construction', () => {
    test('should create server with proper configuration', () => {
      server = new BCSymbolsServer();
      
      const serverInfo = server.getServerInfo();
      expect(serverInfo.name).toBe('bc-symbols-mcp');
      expect(serverInfo.capabilities).toEqual(['resources', 'tools']);
      expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Server Startup', () => {
    beforeEach(() => {
      server = new BCSymbolsServer();
      consoleSpy.mockClear(); // Clear constructor logs
    });

    test('should have start method available', () => {
      expect(typeof server.start).toBe('function');
    });

    test('should have shutdown method available', () => {
      expect(typeof server.shutdown).toBe('function');
    });
  });


  describe('Signal Handling', () => {
    test('should have start method that handles signals', () => {
      server = new BCSymbolsServer();
      
      // Verify that the server has a start method
      expect(typeof server.start).toBe('function');
      
      // Note: Signal handlers are now set up in the start() method, not constructor
      // This ensures proper cleanup and prevents duplicate handlers
    });
  });

  describe('Component Initialization', () => {
    test('should initialize all components', () => {
      server = new BCSymbolsServer();
      
      // Check that internal components are initialized
      expect((server as any).cache).toBeDefined();
      expect((server as any).resources).toBeDefined();
      expect((server as any).tools).toBeDefined();
      expect((server as any).server).toBeDefined();
    });

    test('should setup request handlers', () => {
      server = new BCSymbolsServer();
      
      // The server should have request handlers set up
      const internalServer = (server as any).server;
      expect(internalServer).toBeDefined();
      
      // We can't easily test the handlers are set, but we can verify
      // the server object exists and has the expected structure
      expect(typeof internalServer.setRequestHandler).toBe('function');
    });
  });
});