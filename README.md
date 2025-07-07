# BC Symbols MCP Server

[![Test](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/test.yml)
[![Release](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/release.yml)
[![CodeQL](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/codeql.yml)
[![npm version](https://badge.fury.io/js/bc-symbols-mcp.svg)](https://badge.fury.io/js/bc-symbols-mcp)

A Model Context Protocol (MCP) server for analyzing Business Central .app files and their symbol information. This server provides tools to extract, parse, and query BC object structures, dependencies, and relationships.

## Features

- **App File Processing**: Extract and parse Business Central .app files (ZIP format with BC-specific structure)
- **Symbol Analysis**: Parse NavxManifest.xml and SymbolReference.json for complete object definitions
- **MCP Resources**: Access raw file data through structured URIs
- **MCP Tools**: Structured queries for BC objects, dependencies, and references
- **Caching**: In-memory caching with file hash-based invalidation
- **Cross-App Analysis**: Analyze relationships and dependencies across multiple loaded apps

## Quick Installation

### Using Claude MCP Add (Recommended)

```bash
# Install directly from npm
claude mcp add bc-symbols-mcp
```

### Using npm

```bash
# Install globally
npm install -g bc-symbols-mcp

# Or install locally in your project
npm install bc-symbols-mcp
```

### From Source

```bash
# Clone the repository
git clone https://github.com/ThaSiouL/bc-symbols-mcp.git
cd bc-symbols-mcp

# Install dependencies and build
npm install
npm run build
```

## Usage

### Configuration for Claude Desktop

Add the following to your Claude Desktop configuration file:

#### Option 1: Using npm global installation
```json
{
  "mcpServers": {
    "bc-symbols": {
      "command": "bc-symbols-mcp"
    }
  }
}
```

#### Option 2: Using npx (no installation required)
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

#### Option 3: From source
```json
{
  "mcpServers": {
    "bc-symbols": {
      "command": "node",
      "args": ["/path/to/bc-symbols-mcp/dist/server.js"],
      "cwd": "/path/to/bc-symbols-mcp"
    }
  }
}
```

## MCP Resources

The server provides the following resource types:

### App-Specific Resources
- `bc-app://{appId}/manifest` - App manifest data
- `bc-app://{appId}/symbols` - Symbol reference data  
- `bc-app://{appId}/objects/{objectType}` - Objects by type (table, page, codeunit, etc.)
- `bc-app://{appId}/info` - Basic app information
- `bc-app://{appId}/dependencies` - Dependency information

### Global Resources
- `bc-apps://all` - List of all loaded apps
- `bc-apps://cache-stats` - Cache statistics

## MCP Tools

The server provides the following tools:

### `load_app_file`
Load and parse a Business Central .app file.

**Parameters:**
- `filePath` (string): Path to the .app file

**Example:**
```json
{
  "filePath": "/path/to/app.app"
}
```

### `query_objects`
Query BC objects by type, name, or ID across loaded apps.

**Parameters:**
- `appIds` (string[], optional): App IDs to search in
- `objectType` (string, optional): Type of object (table, page, codeunit, etc.)
- `objectName` (string, optional): Name of the object
- `objectId` (number, optional): ID of the object
- `includeExtensions` (boolean, optional): Include extension objects

### `analyze_dependencies`
Analyze dependencies for a specific app.

**Parameters:**
- `appId` (string): ID of the app to analyze
- `includeTransitive` (boolean, optional): Include transitive dependencies
- `direction` (string, optional): Direction of dependencies (incoming, outgoing, both)

### `find_references`
Find references to a specific object, field, or method.

**Parameters:**
- `appIds` (string[], optional): App IDs to search in
- `objectType` (string): Type of the target object
- `objectName` (string): Name of the target object
- `fieldName` (string, optional): Field to find references to
- `methodName` (string, optional): Method to find references to

### `get_object_details`
Get detailed information about a specific BC object.

**Parameters:**
- `appId` (string): App ID containing the object
- `objectType` (string): Type of the object
- `objectIdentifier` (string): Name or ID of the object

### `list_loaded_apps`
List all loaded apps with their basic information.

### `get_app_info`
Get detailed information about a specific app.

**Parameters:**
- `appId` (string): ID of the app

### `clear_cache`
Clear the app cache.

## File Format Support

### Business Central .app Files
- ZIP format with 40-byte prefix
- Contains NavxManifest.xml for app metadata
- Contains SymbolReference.json for object definitions
- Includes AL source code and other resources

### Supported BC Object Types
- Tables and Table Extensions
- Pages and Page Extensions  
- Codeunits
- Reports and Report Extensions
- XMLPorts
- Queries
- Enums
- Interfaces
- Permission Sets and Extensions
- Control Add-ins

## Architecture

```
src/
├── server.ts              # Main MCP server implementation
├── processors/
│   ├── app-extractor.ts    # ZIP extraction and parsing
│   └── symbol-parser.ts    # SymbolReference.json parsing
├── cache/
│   └── memory-cache.ts     # In-memory caching
├── resources/
│   └── bc-resources.ts     # MCP Resources implementation
├── tools/
│   └── bc-tools.ts         # MCP Tools implementation
└── types/
    └── bc-types.ts         # TypeScript type definitions
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (watch)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Examples

### Loading an App File
```typescript
// Using the load_app_file tool
{
  "filePath": "/path/to/MyApp_1.0.0.0.app"
}
```

### Querying Objects
```typescript
// Find all tables in a specific app
{
  "appIds": ["d543d3b8-6359-46d3-ab38-cd4cdd79457f"],
  "objectType": "table"
}

// Find a specific page by name
{
  "objectType": "page",
  "objectName": "Customer Card"
}
```

### Analyzing Dependencies
```typescript
// Get all dependencies for an app
{
  "appId": "d543d3b8-6359-46d3-ab38-cd4cdd79457f",
  "includeTransitive": true,
  "direction": "both"
}
```

## Requirements

- Node.js 24+ (also supports 22.x and 20.x)
- TypeScript 5.3+
- Business Central .app files for analysis

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests: `npm run lint && npm test`
6. Submit a pull request

### Automated CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **🧪 Tests**: Automatically run on all pull requests and pushes to main
- **🚀 Releases**: Automatic versioning and publishing when code is merged to main
- **🔒 Security**: CodeQL security scanning and dependency updates
- **📦 Dependencies**: Weekly automated dependency update PRs

#### Version Control
Releases are automatically versioned based on commit messages:
- `feat:` → Minor version bump (1.0.0 → 1.1.0)
- `fix:` → Patch version bump (1.0.0 → 1.0.1)  
- `BREAKING CHANGE:` → Major version bump (1.0.0 → 2.0.0)

Add `[skip ci]` to commit messages to skip automated workflows.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built using the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Supports Microsoft Dynamics 365 Business Central AL development workflows