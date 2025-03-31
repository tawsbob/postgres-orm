# Enum Orchestrator

The Enum Orchestrator is a component that helps manage PostgreSQL enum types in your database migrations. It can detect when enum types need to be added, removed, or updated between schema versions.

## Overview

When working with PostgreSQL, enum types provide custom data types with predefined values. The Enum Orchestrator helps with:

1. Identifying which enum types need to be added to a new schema
2. Identifying which enum types should be removed from an existing schema
3. Detecting when enum values need to be updated
4. Generating the appropriate SQL migration steps for these changes

## How to Use

### In Schema Files

Define enums in your schema files using the `enum` keyword:

```
// Basic enum definition
enum UserRole {
  ADMIN
  USER
  GUEST
}

// Another enum example
enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}
```

### Comparing Schemas

To generate a migration by comparing two schemas (detecting differences in enum types):

```bash
npx preview-migration --from-schema schema/current.schema --schema schema/new.schema
```

This will:
1. Parse both schema files
2. Compare enum types (and other schema objects)
3. Generate migration steps for any differences
4. Show a preview of the migration

### Migration Steps

For enum types, the following types of migration steps can be generated:

- `CREATE TYPE AS ENUM` for new enum types
- `DROP TYPE` for removed enum types
- A combination of `DROP TYPE` and `CREATE TYPE AS ENUM` for updated enum values

## Implementation Details

The Enum Orchestrator consists of the following components:

1. **EnumOrchestrator class**: Core functionality for comparing enum types and generating migration steps
2. **MigrationGenerator integration**: The ability to generate migrations based on schema comparisons
3. **CLI integration**: Command-line support for comparing schemas

## Example

Let's say you have a current schema with:
```
enum UserRole {
  ADMIN
  USER
}
```

And a new schema with:
```
enum UserRole {
  ADMIN
  USER
  GUEST
}
```

The Enum Orchestrator will detect the difference and generate:
- Update steps for `UserRole` (values changed - added GUEST)

The resulting migration SQL will look like:

```sql
-- Drop the old enum type
DROP TYPE IF EXISTS "public"."UserRole" CASCADE;

-- Create the new enum type with updated values
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER', 'GUEST');
```

## Best Practices

1. **Consider the impact of enum changes** - dropping and recreating an enum can cause issues with dependent objects
2. **Test enum migrations** thoroughly, especially when modifying existing enum types
3. **Follow a consistent naming convention** for enum types
4. **Review migration previews** before applying them to production 