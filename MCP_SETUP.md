# MCP Setup Guide for BC Symbols Server

This guide helps you set up the BC Symbols MCP Server with Claude Desktop and other MCP clients.

## Claude Desktop Configuration

### Location of Configuration File

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

### Configuration Examples

#### Quick Setup (Recommended)
```json
{
  "mcpServers": {
    "bc-symbols": {
      "command": "npx",
      "args": ["bc-symbols-mcp"]
    }
  }
}
```

#### Global Installation
```json
{
  "mcpServers": {
    "bc-symbols": {
      "command": "bc-symbols-mcp"
    }
  }
}
```

#### With Custom Environment Variables
```json
{
  "mcpServers": {
    "bc-symbols": {
      "command": "npx",
      "args": ["bc-symbols-mcp"],
      "env": {
        "BC_CACHE_TTL": "120",
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Verification

After configuring, restart Claude Desktop and look for:

1. **MCP Connection**: Claude should show "BC Symbols MCP Server" in the available tools
2. **Available Tools**: You should see tools like:
   - `load_app_file`
   - `query_objects`
   - `analyze_dependencies`
   - `find_references`
   - `get_object_details`
   - `list_loaded_apps`
   - `get_app_info`
   - `clear_cache`

3. **Available Resources**: Resource patterns like:
   - `bc-app://{appId}/manifest`
   - `bc-app://{appId}/symbols`
   - `bc-app://{appId}/objects/{objectType}`

## Example Usage

Once connected, you can ask Claude:

```
Load the BC app file at /path/to/your/app.app and show me all the tables
```

```
What fields are in the Customer table from the loaded BC app?
```

```
Show me the dependencies for the loaded BC application
```

## Troubleshooting

### Server Not Starting
- Ensure Node.js 18+ is installed
- Check that the package is properly installed: `npm list -g bc-symbols-mcp`
- Try running directly: `npx bc-symbols-mcp` to see error messages

### No Tools Visible
- Restart Claude Desktop completely
- Check the configuration file syntax (valid JSON)
- Verify the file path is correct

### Permission Issues
- Ensure Claude Desktop has permission to execute npm/npx
- Try running the command manually first to verify it works

### File Access Issues
- Ensure the BC .app files you want to analyze are accessible
- Check file permissions on the .app files
- Verify the file paths are absolute, not relative

## Advanced Configuration

### Custom Cache Settings
You can set environment variables to customize behavior:

```json
{
  "mcpServers": {
    "bc-symbols": {
      "command": "npx",
      "args": ["bc-symbols-mcp"],
      "env": {
        "BC_CACHE_TTL": "60",
        "BC_MAX_CACHE_SIZE": "100"
      }
    }
  }
}
```

### Multiple Server Instances
You can run multiple instances with different configurations:

```json
{
  "mcpServers": {
    "bc-symbols-prod": {
      "command": "npx",
      "args": ["bc-symbols-mcp"]
    },
    "bc-symbols-dev": {
      "command": "node",
      "args": ["/path/to/dev/bc-symbols-mcp/dist/server.js"]
    }
  }
}
```