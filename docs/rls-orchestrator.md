# RLS Orchestrator

The RLS Orchestrator is a component that helps manage PostgreSQL Row Level Security (RLS) settings in your database migrations. It can detect when RLS settings need to be added, removed, or updated between schema versions.

## Overview

When working with PostgreSQL, Row Level Security allows you to restrict which rows users can see or manipulate based on policies. The RLS Orchestrator helps with:

1. Identifying which tables need RLS to be enabled in a new schema
2. Identifying which tables should have RLS disabled in an existing schema
3. Detecting when RLS settings (enabled/disabled, force/no force) need to be updated
4. Generating the appropriate SQL migration steps for these changes

## How to Use

### In Schema Files

Define RLS settings in your schema files using the `rowLevelSecurity` property:

```
model User {
  id UUID id
  name VARCHAR
  email VARCHAR unique
  
  rowLevelSecurity {
    enabled true
    force true
  }
}
```

### Comparing Schemas

To generate a migration by comparing two schemas (detecting differences in RLS settings):

```bash
npx preview-migration --from-schema schema/current.schema --schema schema/new.schema
```

This will:
1. Parse both schema files
2. Compare RLS settings (and other schema objects)
3. Generate migration steps for any differences
4. Show a preview of the migration

### Migration Steps

For RLS, the following types of migration steps can be generated:

- `ENABLE ROW LEVEL SECURITY` for tables where RLS needs to be enabled
- `DISABLE ROW LEVEL SECURITY` for tables where RLS needs to be disabled
- `FORCE ROW LEVEL SECURITY` for tables where RLS policies should apply to the table owner
- `NO FORCE ROW LEVEL SECURITY` for tables where RLS policies should not apply to the table owner

## Implementation Details

The RLS Orchestrator consists of the following components:

1. **RLSOrchestrator class**: Core functionality for comparing RLS settings and generating migration steps
2. **MigrationGenerator integration**: The ability to generate migrations based on schema comparisons
3. **SQL generation**: Functions to create the appropriate SQL commands for RLS operations

## Example

Let's say you have a current schema with:
```
model User {
  id UUID id
  name VARCHAR
  
  rowLevelSecurity {
    enabled true
    force false
  }
}
```

And a new schema with:
```
model User {
  id UUID id
  name VARCHAR
  
  rowLevelSecurity {
    enabled true
    force true
  }
}
```

The RLS Orchestrator will detect that the `force` setting has changed from `false` to `true` and generate a migration step to update it:

```sql
-- Update RLS force setting
ALTER TABLE "public"."User" FORCE ROW LEVEL SECURITY;
```

## Best Practices

1. **Always define policies** when enabling RLS, as tables with RLS enabled but no policies will not be accessible
2. **Test RLS migrations** thoroughly before applying them to production
3. **Consider using the FORCE option** if you want RLS policies to apply to the database owner
4. **Review migration previews** before applying them to production 