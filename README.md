# BC Symbols MCP Server

[![Test](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/test.yml)
[![Release](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/release.yml)
[![CodeQL](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/codeql.yml)
[![npm version](https://badge.fury.io/js/bc-symbols-mcp.svg)](https://badge.fury.io/js/bc-symbols-mcp)

A Model Context Protocol (MCP) server that analyzes Microsoft Dynamics 365 Business Central .app files and provides intelligent insights about AL code, objects, dependencies, and relationships. Perfect for AL developers, consultants, and architects working with Business Central extensions.

## Use Cases

### 🔍 **Code Analysis & Documentation**
- Automatically analyze Business Central .app files to understand object structures
- Generate documentation from AL code and symbol definitions
- Explore dependencies between extensions and base application objects
- Find usage patterns and relationships across multiple apps

### 🏗️ **Extension Development**
- Quickly understand existing extension structures before making modifications
- Identify potential conflicts between extensions
- Analyze object dependencies to plan safe updates
- Find references to tables, fields, and procedures across the codebase

### 🔧 **Troubleshooting & Maintenance**
- Investigate runtime issues by examining object relationships
- Find all references to deprecated objects or fields
- Analyze extension compatibility with base application updates
- Understand impact of changes across dependent extensions

### 📊 **Architecture Review**
- Review extension design patterns and best practices
- Analyze object distribution and naming conventions
- Identify circular dependencies and architectural issues
- Generate reports on extension complexity and size

## Installation

### VS Code (Claude Dev Extension)

1. Install the [Claude Dev extension](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) in VS Code
2. Add to your Claude Dev MCP configuration in VS Code settings:

```json
{
  "claude-dev.mcpServers": {
    "bc-symbols": {
      "command": "npx",
      "args": ["bc-symbols-mcp"]
    }
  }
}
```

Or if you prefer global installation:
```bash
npm install -g bc-symbols-mcp
```

```json
{
  "claude-dev.mcpServers": {
    "bc-symbols": {
      "command": "bc-symbols-mcp"
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

### Claude Code CLI

If using Claude Code CLI, add to your MCP configuration:

```json
{
  "mcpServers": {
    "bc-symbols": {
      "command": "bc-symbols-mcp"
    }
  }
}
```

### Manual Installation

```bash
# Install globally
npm install -g bc-symbols-mcp

# Or use directly with npx (no installation needed)
npx bc-symbols-mcp
```

## Available Commands

### 🚀 **Getting Started Commands**

#### `configure_app_sources`
Set up paths to your Business Central .app files for analysis.

**Parameters:**
- `paths` (string[]): Array of file paths or directory paths containing .app files
- `autoLoad` (boolean, optional): Automatically load discovered app files (default: true)
- `recursive` (boolean, optional): Scan subdirectories recursively (default: true)
- `replace` (boolean, optional): Replace existing configuration instead of appending (default: false)

**Example:**
```json
{
  "paths": [
    "/path/to/MyExtension_1.0.0.0.app",
    "/path/to/extensions/directory",
    "C:\\AL\\Extensions"
  ],
  "autoLoad": true,
  "recursive": true
}
```

#### `get_app_sources`
View current configuration and discovered .app files.

**Parameters:**
- `rescan` (boolean, optional): Rescan directories for app files (default: false)

**Example:**
```json
{
  "rescan": true
}
```

### 📁 **App Management Commands**

#### `load_app_file`
Load and parse a specific Business Central .app file.

**Example:**
```json
{
  "filePath": "/path/to/MyExtension_1.0.0.0.app"
}
```

#### `list_loaded_apps`
List all currently loaded apps with their basic information.

**Example:**
```json
{}
```

#### `get_app_info`
Get detailed information about a specific app including dependencies and object counts.

**Example:**
```json
{
  "appId": "d543d3b8-6359-46d3-ab38-cd4cdd79457f"
}
```

### 🔍 **Object Analysis Commands**

#### `query_objects`
Search for Business Central objects across loaded apps.

**Parameters:**
- `appIds` (string[], optional): Specific app IDs to search in
- `objectType` (string, optional): Object type (table, page, codeunit, report, etc.)
- `objectName` (string, optional): Object name (supports partial matching)
- `objectId` (number, optional): Specific object ID
- `includeExtensions` (boolean, optional): Include extension objects (default: true)

**Examples:**
```json
// Find all tables across all loaded apps
{
  "objectType": "table"
}

// Find Customer-related pages in a specific app
{
  "appIds": ["d543d3b8-6359-46d3-ab38-cd4cdd79457f"],
  "objectType": "page",
  "objectName": "Customer"
}

// Find object by ID
{
  "objectType": "table",
  "objectId": 18
}
```

#### `get_object_details`
Get comprehensive details about a specific Business Central object.

**Example:**
```json
{
  "appId": "d543d3b8-6359-46d3-ab38-cd4cdd79457f",
  "objectType": "table",
  "objectIdentifier": "Customer"
}
```

### 🔗 **Dependency Analysis Commands**

#### `analyze_dependencies`
Analyze dependencies for a specific app.

**Parameters:**
- `appId` (string): App ID to analyze
- `includeTransitive` (boolean, optional): Include indirect dependencies (default: true)
- `direction` (string, optional): Direction of analysis (incoming, outgoing, both)

**Example:**
```json
{
  "appId": "d543d3b8-6359-46d3-ab38-cd4cdd79457f",
  "includeTransitive": true,
  "direction": "both"
}
```

#### `find_references`
Find all references to a specific object, field, or method across loaded apps.

**Parameters:**
- `appIds` (string[], optional): Specific apps to search in
- `objectType` (string): Type of the target object
- `objectName` (string): Name of the target object
- `fieldName` (string, optional): Specific field to find references to
- `methodName` (string, optional): Specific method to find references to

**Examples:**
```json
// Find all references to Customer table
{
  "objectType": "table",
  "objectName": "Customer"
}

// Find references to a specific field
{
  "objectType": "table",
  "objectName": "Customer",
  "fieldName": "Name"
}

// Find references to a specific method
{
  "objectType": "codeunit",
  "objectName": "Sales-Post",
  "methodName": "PostInvoice"
}
```

### 🧹 **Utility Commands**

#### `clear_cache`
Clear the app cache to free memory or reload modified files.

**Example:**
```json
{}
```

## Supported BC Object Types

- **Tables** and **Table Extensions**
- **Pages** and **Page Extensions**
- **Codeunits**
- **Reports** and **Report Extensions**
- **XMLPorts**
- **Queries**
- **Enums**
- **Interfaces**
- **Permission Sets** and **Permission Set Extensions**
- **Control Add-ins**

## MCP Resources

Access raw data through structured URIs:

### App-Specific Resources
- `bc-app://{appId}/manifest` - App manifest data
- `bc-app://{appId}/symbols` - Symbol reference data  
- `bc-app://{appId}/objects/{objectType}` - Objects by type
- `bc-app://{appId}/info` - Basic app information
- `bc-app://{appId}/dependencies` - Dependency information

### Global Resources
- `bc-apps://all` - List of all loaded apps
- `bc-apps://cache-stats` - Cache statistics

## Example Workflow

Here's a typical workflow for analyzing a Business Central extension:

1. **Configure your app sources:**
```json
{
  "paths": ["/path/to/extensions/directory"],
  "autoLoad": true,
  "recursive": true
}
```

2. **Explore loaded apps:**
```json
{}
// Use list_loaded_apps command
```

3. **Analyze a specific extension:**
```json
{
  "appId": "your-extension-id",
  "includeTransitive": true,
  "direction": "both"
}
// Use analyze_dependencies command
```

4. **Find object relationships:**
```json
{
  "objectType": "table",
  "objectName": "Customer"
}
// Use find_references command
```

5. **Get detailed object information:**
```json
{
  "appId": "your-extension-id",
  "objectType": "page",
  "objectIdentifier": "Customer List"
}
// Use get_object_details command
```

## Requirements

- Node.js 20+ (recommended: 24+)
- Business Central .app files for analysis
- VS Code with Claude Dev extension, Claude Desktop, or Claude Code CLI

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests: `npm run lint && npm test`
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built using the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Supports Microsoft Dynamics 365 Business Central AL development workflows