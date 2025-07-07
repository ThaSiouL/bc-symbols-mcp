#!/bin/bash

# Test Release Script
# This script simulates the release process locally for testing

set -e

echo "🧪 BC Symbols MCP - Local Release Test"
echo "======================================"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: Not on main branch (currently on: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: Working directory has uncommitted changes"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Installing dependencies..."
npm ci

echo "🧪 Running tests..."
npm test

echo "🔍 Running linting..."
npm run lint

echo "🏗️  Building project..."
npm run build

echo "🔒 Running security audit..."
npm audit --audit-level moderate

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📄 Current version: $CURRENT_VERSION"

# Simulate version bump based on recent commits
echo "🔍 Analyzing recent commits for version bump..."
LATEST_COMMIT=$(git log -1 --pretty=format:"%s")
echo "Latest commit: $LATEST_COMMIT"

if [[ "$LATEST_COMMIT" == *"BREAKING CHANGE"* ]] || [[ "$LATEST_COMMIT" == *"[major]"* ]]; then
    BUMP_TYPE="major"
elif [[ "$LATEST_COMMIT" == *"feat"* ]] || [[ "$LATEST_COMMIT" == *"[minor]"* ]]; then
    BUMP_TYPE="minor"
else
    BUMP_TYPE="patch"
fi

echo "🔧 Suggested version bump: $BUMP_TYPE"

# Show what the new version would be
NEW_VERSION=$(npm version $BUMP_TYPE --dry-run --no-git-tag-version | tr -d 'v')
echo "📈 New version would be: $NEW_VERSION"

echo ""
echo "✅ Release test completed successfully!"
echo ""
echo "🚀 To actually release:"
echo "   1. Commit and push your changes to main branch"
echo "   2. GitHub Actions will automatically:"
echo "      - Run tests"
echo "      - Bump version ($BUMP_TYPE)"
echo "      - Create GitHub release"
echo "      - Publish to NPM (if NPM_TOKEN is configured)"
echo ""
echo "📝 Tips:"
echo "   - Use 'feat:' prefix for new features (minor bump)"
echo "   - Use 'fix:' prefix for bug fixes (patch bump)"
echo "   - Add 'BREAKING CHANGE:' for major bumps"
echo "   - Add '[skip ci]' to skip automated release"