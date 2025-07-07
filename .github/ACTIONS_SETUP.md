# GitHub Actions Setup Guide

This guide explains how to set up the automated CI/CD workflows for the BC Symbols MCP project.

## 🚀 Quick Setup

1. **Push to GitHub**: Ensure your repository is pushed to GitHub
2. **Configure NPM Token** (optional): Add `NPM_TOKEN` secret for automated publishing
3. **Make first commit**: Push any change to trigger the workflows

## 📋 Required Secrets

### NPM_TOKEN (Optional but Recommended)

For automated NPM publishing:

1. **Create NPM Access Token**:
   ```bash
   npm login
   npm token create --access=public
   ```

2. **Add to GitHub**:
   - Go to your repository on GitHub
   - Settings → Secrets and variables → Actions  
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your NPM access token

### GITHUB_TOKEN (Automatic)

This is automatically provided by GitHub Actions - no setup required.

## 🔄 Workflow Overview

### 1. Test Workflow (`test.yml`)
**Triggers**: Pull requests, pushes to main

**What it does**:
- Tests on Node.js 24.x, 22.x, 20.x
- Runs linting (`npm run lint`)
- Runs tests (`npm test`)
- Builds project (`npm run build`)  
- Security audit (`npm audit`)

### 2. Release Workflow (`release.yml`)
**Triggers**: Pushes to main (excluding docs)

**What it does**:
- Runs full test suite
- Determines version bump from commit message
- Updates package.json version
- Creates Git tag
- Creates GitHub release with changelog
- Publishes to NPM (if token available)

### 3. CodeQL Security Scan (`codeql.yml`)
**Triggers**: Pushes, PRs, weekly schedule

**What it does**:
- Static security analysis
- Vulnerability scanning
- Security alerts in GitHub Security tab

### 4. Dependency Updates (`dependency-update.yml`)
**Triggers**: Weekly schedule, manual

**What it does**:
- Checks for outdated dependencies
- Creates automated PR with updates
- Runs tests to verify compatibility

## 🏷️ Version Control

Automatic versioning based on commit messages:

### Patch Version (1.0.0 → 1.0.1)
```bash
git commit -m "fix: resolve memory leak"
git commit -m "chore: update documentation"
```

### Minor Version (1.0.0 → 1.1.0)
```bash
git commit -m "feat: add object indexing"
git commit -m "feat: implement lazy loading"
```

### Major Version (1.0.0 → 2.0.0)
```bash
git commit -m "feat: redesign API

BREAKING CHANGE: removed deprecated methods"
```

### Manual Override
```bash
git commit -m "fix: urgent patch [patch]"
git commit -m "docs: update readme [minor]"
git commit -m "refactor: new architecture [major]"
```

### Skip CI
```bash
git commit -m "docs: fix typo [skip ci]"
```

## 🔧 Manual Controls

### Test Release Locally
```bash
npm run test-release
```

### Trigger Dependency Updates
1. Go to Actions tab in GitHub
2. Select "Dependency Updates"
3. Click "Run workflow"

### Force Release
Push any commit to main branch (will auto-version and release)

## 📊 Monitoring

### Status Badges
Add to your README.md:
```markdown
[![Test](https://github.com/YOUR_USERNAME/bc-symbols-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/YOUR_USERNAME/bc-symbols-mcp/actions/workflows/test.yml)
[![Release](https://github.com/YOUR_USERNAME/bc-symbols-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/YOUR_USERNAME/bc-symbols-mcp/actions/workflows/release.yml)
```

### View Workflow Results
- Go to Actions tab in your GitHub repository
- Click on any workflow run to see details
- Check logs, artifacts, and status

## 🛠️ Troubleshooting

### Failed Tests
- Check the Actions tab for detailed logs
- Fix issues locally and push again
- Tests must pass before release

### NPM Publish Fails
- Verify NPM_TOKEN secret is correct
- Check if package name is available
- Ensure version number is incremented

### Release Not Created
- Check if commit message triggers version bump
- Verify no `[skip ci]` in commit message
- Check Actions logs for errors

### Security Alerts
- Check Security tab in GitHub
- Review CodeQL findings
- Update dependencies if needed

## 📚 Best Practices

1. **Always write meaningful commit messages**
2. **Use conventional commit format for auto-versioning**
3. **Test locally before pushing to main**
4. **Review dependency update PRs carefully**
5. **Monitor security alerts regularly**

## 🆘 Getting Help

- Check the [GitHub Actions documentation](https://docs.github.com/en/actions)
- Review workflow files in `.github/workflows/`
- Open an issue if workflows fail unexpectedly