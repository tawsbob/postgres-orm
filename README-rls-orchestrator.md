# PostgreSQL RLS Orchestrator

This document provides a quick start guide to using the RLS Orchestrator feature in the PostgreSQL ORM.

## Overview

The RLS (Row Level Security) Orchestrator helps you manage PostgreSQL row-level security settings in your database migrations by:

- Detecting when RLS needs to be enabled for tables
- Detecting when RLS needs to be disabled for tables
- Detecting when RLS force settings need to be updated
- Generating appropriate SQL migration steps for all these changes

## Getting Started

### 1. Define RLS Settings in Your Schema Files

```
model User {
  id UUID id
  name VARCHAR
  
  // Enable RLS with force option
  rowLevelSecurity {
    enabled true
    force true
  }
  
  // Define policies
  policy user_policy {
    for [select, update, delete]
    to authenticated
    using "(auth.uid() = id)"
  }
}
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
# Run all RLS-related tests
npm run test:rls:all

# Run specific test suites
npm run test:rls:orchestrator  # Test the orchestrator core functionality
npm run test:rls:generator     # Test migration generator integration
npm run test:rls               # Test basic RLS management
```

## Example Workflow

1. You have a current schema with a `User` table with RLS enabled but not forced
2. You update your schema to change the RLS force setting to true
3. Run the comparison tool:
   ```bash
   npm run preview:migration:compare
   ```
4. Review the generated migration, which will:
   - Update the RLS settings to FORCE ROW LEVEL SECURITY
5. Apply the migration to your database

## Additional Documentation

For more detailed information, see the full documentation in [docs/rls-orchestrator.md](docs/rls-orchestrator.md). 