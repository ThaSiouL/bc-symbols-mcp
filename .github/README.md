# GitHub Actions Workflows

This directory contains automated workflows for the BC Symbols MCP project.

## Workflows

### 🧪 Test (`test.yml`)
**Trigger**: Pull requests and pushes to main branch

- Runs tests on Node.js versions 24.x, 22.x, and 20.x
- Executes linting, testing, and building
- Includes security audit
- Uploads test artifacts

### 🚀 Release (`release.yml`) 
**Trigger**: Pushes to main branch (excluding docs and config files)

- Runs full test suite
- Automatically determines version bump based on commit messages:
  - `feat:` or `[minor]` → Minor version bump
  - `BREAKING CHANGE` or `[major]` → Major version bump  
  - Everything else → Patch version bump
- Creates Git tag and GitHub release
- Publishes to NPM (if `NPM_TOKEN` secret is configured)
- Generates installation instructions

### 🔒 CodeQL Security Scan (`codeql.yml`)
**Trigger**: Pushes, pull requests, and weekly schedule

- Performs static security analysis
- Scans for common vulnerabilities
- Generates security reports

### 📦 Dependency Updates (`dependency-update.yml`)
**Trigger**: Weekly schedule and manual dispatch

- Checks for outdated dependencies
- Creates automated pull request with updates
- Runs tests to verify compatibility

## Setup Instructions

### Required Secrets

1. **`GITHUB_TOKEN`** - Automatically provided by GitHub Actions
2. **`NPM_TOKEN`** - (Optional) For publishing to NPM
   - Go to Repository Settings → Secrets and variables → Actions
   - Add new repository secret named `NPM_TOKEN`
   - Value should be your NPM access token

### NPM Token Setup

1. Create NPM account and login: `npm login`
2. Generate access token: `npm token create --access=public`
3. Add token to GitHub repository secrets

## Commit Message Conventions

To control versioning automatically, use these commit message formats:

```bash
# Patch version (1.0.0 → 1.0.1)
fix: resolve memory leak in cache
chore: update dependencies

# Minor version (1.0.0 → 1.1.0)  
feat: add object indexing
feat: implement lazy loading

# Major version (1.0.0 → 2.0.0)
feat: redesign API
BREAKING CHANGE: removed deprecated methods

# Skip CI
chore: update README [skip ci]
```

## Manual Controls

- **Skip CI**: Add `[skip ci]` to commit message
- **Force version**: Add `[patch]`, `[minor]`, or `[major]` to commit message
- **Manual dependency update**: Go to Actions → Dependency Updates → Run workflow

## Status Badges

Add these to your README.md:

```markdown
[![Test](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/test.yml)
[![Release](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/release.yml)
[![CodeQL](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/ThaSiouL/bc-symbols-mcp/actions/workflows/codeql.yml)
```