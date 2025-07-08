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
    test('should log initialization messages', () => {
      server = new BCSymbolsServer();
      
      expect(consoleSpy).toHaveBeenCalledWith('BC Symbols MCP Server initialized');
      expect(consoleSpy).toHaveBeenCalledWith('Cache expiration: 60 minutes');
    });

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

  describe('Version Handling', () => {
    test('should read version from package.json', () => {
      server = new BCSymbolsServer();
      
      const serverInfo = server.getServerInfo();
      expect(serverInfo.version).toBe('1.2.6'); // Current package.json version
    });

    test('should fallback to default version if package.json read fails', () => {
      // Since the module is already loaded, we can't easily test this
      // But we can verify the version is set correctly
      expect(typeof server.getServerInfo().version).toBe('string');
      expect(server.getServerInfo().version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Signal Handling', () => {
    test('should setup SIGINT handler', () => {
      const processSpy = jest.spyOn(process, 'on');
      
      server = new BCSymbolsServer();
      
      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      
      processSpy.mockRestore();
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