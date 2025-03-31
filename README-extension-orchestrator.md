# PostgreSQL Extension Orchestrator

This document provides a quick start guide to using the new Extension Orchestrator feature in the PostgreSQL ORM.

## Overview

The Extension Orchestrator helps you manage PostgreSQL extensions in your database migrations by:

- Detecting when extensions need to be added
- Detecting when extensions need to be removed
- Detecting when extension versions need to be updated
- Generating appropriate SQL migration steps for all these changes

## Getting Started

### 1. Define Extensions in Your Schema Files

```
// Basic extension without version
extension pg_trgm

// Extension with specific version
extension hstore(version='1.4')
```

### 2. Compare Schema Changes

To generate migrations based on differences between schema versions:

```bash
# Using the CLI
npm run preview:migration:compare

# With custom schema files
npm run preview:migration -- --from-schema schema/current.schema --schema schema/new.schema
```

### 3. Run Tests

```bash
# Run all extension-related tests
npm run test:extensions:all

# Run specific test suites
npm run test:extension:orchestrator  # Test the orchestrator core functionality
npm run test:extension:generator     # Test migration generator integration
npm run test:extension              # Test basic extension management
```

## Example Workflow

1. You have a current schema with `pg_trgm` extension
2. You update your schema to add `uuid-ossp` and update `pg_trgm` to a specific version
3. Run the comparison tool:
   ```bash
   npm run preview:migration:compare
   ```
4. Review the generated migration, which will:
   - Drop and recreate `pg_trgm` with the new version
   - Create the new `uuid-ossp` extension
5. Apply the migration to your database

## Additional Documentation

For more detailed information, see the full documentation in [docs/extension-orchestrator.md](docs/extension-orchestrator.md). 