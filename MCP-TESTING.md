# BC Symbols MCP Server Testing Guide

This document provides comprehensive testing instructions for the BC Symbols MCP server.

## Quick Test Summary

✅ **MCP Server Status**: Working correctly  
✅ **Protocol Initialization**: Successful  
✅ **Resources**: Available (6 resources found)  
✅ **Tools**: Available (10 tools found)  
✅ **App Loading**: Successful  
✅ **Object Querying**: Functional  
✅ **Resource Reading**: Working  

## Test Files

### 1. `simple-test.js` - Basic MCP Protocol Test
Tests the core MCP protocol functionality:
- Server startup
- MCP initialization
- List resources
- List tools
- Tool execution
- Resource reading

**Run with:**
```bash
node simple-test.js
```

### 2. `test-with-app.js` - Comprehensive Test with Sample App
Creates a test .app file and tests the full functionality:
- App file creation
- App loading
- Object querying
- Resource reading
- Complete MCP workflow

**Run with:**
```bash
node test-with-app.js
```

### 3. `test-mcp-client.js` - SDK-based Test (Legacy)
Uses the MCP SDK client library (may have compatibility issues).

## Manual Testing

### Starting the Server
```bash
# Build the project
npm run build

# Start the server
npm start
# or
node dist/server.js
```

The server uses stdio transport and will wait for JSON-RPC messages on stdin.

### Testing with cURL or Manual JSON-RPC

Send JSON-RPC messages to the server:

```bash
# Initialize the connection
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' | node dist/server.js

# List available tools
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/server.js

# List available resources
echo '{"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}' | node dist/server.js
```

## Available Tools

1. **load_app_file** - Load and parse a Business Central .app file
2. **query_objects** - Query BC objects by type, name, or ID
3. **analyze_dependencies** - Analyze dependencies for a specific app
4. **find_references** - Find references to objects, fields, or methods
5. **get_object_details** - Get detailed information about a specific object
6. **list_loaded_apps** - List all loaded apps
7. **get_app_info** - Get detailed information about a specific app
8. **clear_cache** - Clear the app cache
9. **configure_app_sources** - Configure app file paths and directories
10. **get_app_sources** - Get current app source configuration

## Available Resources

1. **bc-apps://all** - List of all loaded BC apps
2. **bc-apps://cache-stats** - Cache statistics and memory usage
3. **bc-app://{appId}/manifest** - App manifest data
4. **bc-app://{appId}/symbols** - Symbol reference data
5. **bc-app://{appId}/objects/{objectType}** - Objects by type
6. **bc-app://{appId}/info** - Basic app information
7. **bc-app://{appId}/dependencies** - Dependency information

## Claude Desktop Integration

### Configuration File

Create or update your Claude Desktop configuration:

**Location**: `~/.claude-config.json` (or appropriate location for your OS)

```json
{
  "mcpServers": {
    "bc-symbols-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/bc-symbols-mcp/dist/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**For this project specifically:**
```json
{
  "mcpServers": {
    "bc-symbols-mcp": {
      "command": "node",
      "args": ["/home/thasioul/projects/bc-symbols-mcp/dist/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Using in Claude Desktop

1. Load the configuration file
2. The server will appear as available resources and tools
3. Use the tools to load .app files and query Business Central objects
4. Access resources to get structured data about loaded apps

## Testing Results

### Test Environment
- **Node.js**: 24.0.0 or higher
- **Platform**: Linux
- **MCP Protocol**: 2024-11-05
- **Server Version**: 1.2.5

### Test Results Summary

| Test | Status | Details |
|------|--------|---------|
| Server Startup | ✅ PASS | Server starts and waits for input |
| MCP Initialization | ✅ PASS | Protocol handshake successful |
| List Resources | ✅ PASS | Returns 6 resources (2 global, 4 per app) |
| List Tools | ✅ PASS | Returns 10 tools |
| Tool Execution | ✅ PASS | `list_loaded_apps` works correctly |
| Resource Reading | ✅ PASS | Can read app manifest and other resources |
| App Loading | ✅ PASS | Successfully loads test .app file |
| Object Querying | ✅ PASS | Can query objects by type |
| Cache Management | ✅ PASS | Cache statistics and cleanup working |
| Error Handling | ✅ PASS | Graceful error handling and shutdown |

### Expected Behavior

1. **Server starts** and waits for JSON-RPC messages on stdin
2. **MCP initialization** returns server capabilities and info
3. **With no apps loaded**: Returns 2 global resources and 10 tools
4. **After loading apps**: Additional resources become available per app
5. **Tool execution** returns structured JSON responses
6. **Resource reading** provides JSON data about apps and objects
7. **Error handling** returns proper error responses
8. **Shutdown** cleans up cache and exits gracefully

## Troubleshooting

### Common Issues

1. **Server won't start**: Check Node.js version (24.0.0+) and build status
2. **No resources found**: This is normal if no apps are loaded
3. **App loading fails**: Check .app file format and path
4. **Tool execution fails**: Check parameter format and required fields
5. **Resource reading fails**: Verify app is loaded and resource URI is correct

### Debug Mode

Run with additional logging:
```bash
NODE_ENV=development node dist/server.js
```

### Cache Issues

Clear cache using the tool:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"clear_cache","arguments":{}}}' | node dist/server.js
```

## Next Steps

1. **Production Usage**: Deploy with proper process management
2. **Integration**: Add to Claude Desktop configuration
3. **App Files**: Load real Business Central .app files
4. **Performance**: Monitor cache usage and optimize for large apps
5. **Features**: Use advanced querying and analysis tools

## Support

For issues or questions:
- Check the server logs (stderr)
- Review the test results
- Verify MCP protocol compatibility
- Check file paths and permissions