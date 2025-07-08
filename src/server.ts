#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
        version: getPackageVersion(),
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

    console.log('BC Symbols MCP Server initialized');
    console.log(`Cache expiration: 60 minutes`);

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
    console.error('BC Symbols MCP Server starting...');
    
    const serverInfo = this.getServerInfo();
    console.error(`Version: ${serverInfo.version}`);
    console.error(`Capabilities: ${serverInfo.capabilities.join(', ')}`);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('BC Symbols MCP Server ready');
    console.error('Listening on stdio transport');
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
      version: getPackageVersion(),
      capabilities: ['resources', 'tools'],
      cacheStats: this.cache.getStats()
    };
  }
}

/**
 * Helper function to get package.json version
 */
function getPackageVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return FALLBACK_VERSION; // Fallback version
  }
}

/**
 * Show help text
 */
function showHelp(): void {
  const helpText = `
BC Symbols MCP Server v${getPackageVersion()}

USAGE:
  bc-symbols-mcp [OPTIONS]

DESCRIPTION:
  Model Context Protocol (MCP) server for analyzing Microsoft Dynamics 365 
  Business Central .app files and their symbol information.

OPTIONS:
  -h, --help     Show this help message and exit
  -v, --version  Show version information and exit

EXAMPLES:
  bc-symbols-mcp              # Start the MCP server
  bc-symbols-mcp --version    # Show version
  bc-symbols-mcp --help       # Show this help

For more information, visit: https://github.com/ThaSiouL/bc-symbols-mcp
`;
  console.log(helpText.trim());
}

/**
 * Show version information
 */
function showVersion(): void {
  console.log(`bc-symbols-mcp v${getPackageVersion()}`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse command line arguments
  let parsedArgs;
  try {
    parsedArgs = parseArgs({
      options: {
        help: { 
          type: 'boolean', 
          short: 'h' 
        },
        version: { 
          type: 'boolean', 
          short: 'v' 
        }
      },
      allowPositionals: false,
      strict: true
    });
  } catch (error) {
    console.error('Error: Invalid command line arguments');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Handle help flag
  if (parsedArgs.values.help) {
    showHelp();
    process.exit(0);
  }

  // Handle version flag
  if (parsedArgs.values.version) {
    showVersion();
    process.exit(0);
  }

  // Continue with normal server startup
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

// Start the server when this module is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { BCSymbolsServer };