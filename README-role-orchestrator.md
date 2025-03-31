# PostgreSQL Role Orchestrator

This document provides a quick start guide to using the Role Orchestrator feature in the PostgreSQL ORM.

## Overview

The Role Orchestrator helps you manage PostgreSQL role changes in your database migrations by:

- Detecting when roles need to be added
- Detecting when roles need to be removed
- Detecting when role privileges need to be updated
- Generating appropriate SQL migration steps for all these changes

## Getting Started

### 1. Define Roles in Your Schema Files

```
role adminRole {
  privileges: ["select", "insert", "update"] on User
}

role readOnlyRole {
  privileges: "all" on User
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
# Run all role-related tests
npm run test:role:all

# Run specific test suites
npm run test:role:orchestrator    # Test the orchestrator core functionality
npm run test:role:integration     # Test migration generator integration
```

## Example Workflow

1. You have a current schema with a `userRole` role that has `SELECT` privileges on the `User` table
2. You update your schema to add `UPDATE` privileges to the role
3. Run the comparison tool:
   ```bash
   npm run preview:migration:compare
   ```
4. Review the generated migration, which will:
   - Drop the existing role
   - Recreate it with the new privileges
5. Apply the migration to your database

## Features

The Role Orchestrator can:

- Detect added roles and generate appropriate CREATE ROLE statements
- Detect removed roles and generate DROP ROLE statements
- Detect changes to role privileges (e.g., adding or removing privileges)
- Generate rollback SQL for all role changes

## Example Role Changes

### Adding a New Role

```
// New schema adds this role
role reportingRole {
  privileges: ["select"] on User
  privileges: ["select"] on Order
}
```

The migration will:
- Create the new role
- Grant the specified privileges

### Updating a Role's Privileges

```
// Old schema
role userRole {
  privileges: ["select"] on User
}

// New schema
role userRole {
  privileges: ["select", "update"] on User
  privileges: ["select"] on Order
}
```

The migration will:
- Drop the existing role
- Recreate it with the updated privileges
- Generate appropriate rollback statements

## Architecture

The Role Orchestrator follows a similar pattern to other orchestrators:

1. **Detection Phase**: It compares two sets of roles to identify differences
2. **Generation Phase**: It generates migration steps based on those differences

## Integration with Migration Generator

The Role Orchestrator is used by the MigrationGenerator to handle role comparisons and migrations. It follows a consistent pattern with the other orchestrators for extensions, enums, tables, and policies.

## Additional Documentation

For more detailed information, see the full documentation in [docs/role-orchestrator.md](docs/role-orchestrator.md). 