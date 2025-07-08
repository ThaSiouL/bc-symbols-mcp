#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MemoryCache } from './cache/memory-cache.js';
import { BCResources } from './resources/bc-resources.js';
import { BCTools } from './tools/bc-tools.js';

/**
 * BC Symbols MCP Server
 * 
 * This server provides access to Business Central .app files and their symbol information
 * through the Model Context Protocol (MCP).
 */
class BCSymbolsServer {
  private server: Server;
  private cache: MemoryCache;
  private resources: BCResources;
  private tools: BCTools;

  constructor() {
    this.server = new Server(
      {
        name: 'bc-symbols-mcp',
        version: '1.0.9',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.cache = new MemoryCache(60); // 60-minute cache expiration
    this.resources = new BCResources(this.cache);
    this.tools = new BCTools(this.cache);

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // Resources handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await this.resources.listResources();
        return { resources };
      } catch (error) {
        throw new Error(`Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const content = await this.resources.readResource(request.params.uri);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'application/json',
              text: content,
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Tools handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = this.tools.getTools();
        return { tools };
      } catch (error) {
        throw new Error(`Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const result = await this.tools.executeTool(request.params.name, request.params.arguments);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });

    // Error handler
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    // Process handlers
    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    console.error('Shutting down BC Symbols MCP Server...');
    
    // Clean up cache
    const stats = this.cache.getStats();
    console.error(`Cache cleanup: ${stats.totalEntries} entries, ${Math.round(stats.totalMemoryUsage / 1024)} KB`);
    this.cache.clear();
    
    console.error('Server shutdown complete');
  }

  /**
   * Get server information
   */
  getServerInfo(): {
    name: string;
    version: string;
    capabilities: string[];
    cacheStats: any;
  } {
    return {
      name: 'bc-symbols-mcp',
      version: '1.0.9',
      capabilities: ['resources', 'tools'],
      cacheStats: this.cache.getStats()
    };
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const server = new BCSymbolsServer();
  
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server when this module is executed
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { BCSymbolsServer };