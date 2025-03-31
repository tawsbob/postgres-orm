# Extension Orchestrator

The Extension Orchestrator is a component that helps manage PostgreSQL extensions in your database migrations. It can detect when extensions need to be added, removed, or updated between schema versions.

## Overview

When working with PostgreSQL, extensions provide additional functionality to your database. The Extension Orchestrator helps with:

1. Identifying which extensions need to be added to a new schema
2. Identifying which extensions should be removed from an existing schema
3. Detecting when extension versions need to be updated
4. Generating the appropriate SQL migration steps for these changes

## How to Use

### In Schema Files

Define extensions in your schema files using the `extension` keyword:

```
// Basic extension without version
extension pg_trgm

// Extension with specific version
extension hstore(version='1.4')

// Multiple extensions
extension postgis
extension uuid-ossp
```

### Comparing Schemas

To generate a migration by comparing two schemas (detecting differences in extensions):

```bash
npx preview-migration --from-schema schema/current.schema --schema schema/new.schema
```

This will:
1. Parse both schema files
2. Compare extensions (and other schema objects)
3. Generate migration steps for any differences
4. Show a preview of the migration

### Migration Steps

For extensions, the following types of migration steps can be generated:

- `CREATE EXTENSION` for new extensions
- `DROP EXTENSION` for removed extensions
- A combination of `DROP EXTENSION` and `CREATE EXTENSION` for updated extension versions

## Implementation Details

The Extension Orchestrator consists of the following components:

1. **ExtensionOrchestrator class**: Core functionality for comparing extensions and generating migration steps
2. **MigrationGenerator integration**: The ability to generate migrations based on schema comparisons
3. **CLI integration**: Command-line support for comparing schemas

## Example

Let's say you have a current schema with:
```
extension pg_trgm
extension hstore(version='1.4')
```

And a new schema with:
```
extension pg_trgm
extension hstore(version='1.5')
extension uuid-ossp
```

The Extension Orchestrator will generate:
- No changes for `pg_trgm` (unchanged)
- Update steps for `hstore` (version change from 1.4 to 1.5)
- Add steps for `uuid-ossp` (new extension)

The resulting migration SQL will look like:

```sql
-- Drop the old version of hstore
DROP EXTENSION IF EXISTS "hstore";

-- Create the new version of hstore
CREATE EXTENSION IF NOT EXISTS "hstore" VERSION '1.5';

-- Add the new uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Best Practices

1. **Always use version numbers** for extensions when a specific version is required
2. **Test extension migrations** thoroughly, as some extensions may have compatibility issues
3. **Consider dependencies** between extensions when ordering migrations
4. **Review migration previews** before applying them to production 