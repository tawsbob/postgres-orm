# Postgres ORM Migration CLI

A powerful CLI tool for managing PostgreSQL database migrations with schema parsing capabilities.

## Installation

```bash
npm install postgres-orm
```

## Configuration

The CLI looks for environment variables in a `.env` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/database
MIGRATIONS_DIR=./migrations
```

## CLI Commands

### Basic Usage

```bash
npx migrate <command> [options]
```

Or using npm scripts:

```bash
npm run migrate:<command> -- [options]
```

### Available Commands

| Command | Description |
|---------|-------------|
| `up` | Run pending migrations |
| `down` | Rollback migrations |
| `status` | Show migration status |
| `generate` | Generate migration from schema |
| `generate:full` | Generate a full migration rather than a diff |
| `init-state` | Initialize schema state without generating a migration |
| `create-custom` | Create a custom migration with your own SQL |

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dir <path>` | Migrations directory | `./migrations` |
| `--connection-string <url>` | Database connection string | `env.DATABASE_URL` |
| `--schema <name>` | Database schema | `public` |
| `--table <name>` | Migrations table name | `schema_migrations` |
| `--help` | Show help message | |

### Migration Examples

#### Run pending migrations

```bash
npm run migrate:up
```

#### Rollback the last migration

```bash
npm run migrate:down -- --steps 1
```

#### Show migration status

```bash
npm run migrate:status
```

#### Generate a migration from schema

```bash
npm run migrate:generate -- --name "add users table"
```

#### Create a custom migration

```bash
npm run migrate:create-custom -- --name "fix data issues"
```

#### Create a custom migration and open in editor

```bash
npm run migrate:create-custom:editor -- --name "add stored procedure"
```

## Custom Migrations

Custom migrations allow you to write raw SQL directly rather than generating it from a schema.

### Creating a Custom Migration

```bash
npm run migrate:create-custom -- --name "my custom migration"
```

This will generate a template file with the following structure:

```sql
-- Migration: my custom migration
-- Version: 20230101120000
-- Timestamp: 2023-01-01T12:00:00.000Z

-- Up Migration
BEGIN;

-- Add your custom up migration SQL here
-- Example:
-- CREATE TABLE public.your_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP NOT NULL DEFAULT NOW()
-- );

COMMIT;

-- Down Migration
BEGIN;

-- Add your custom down migration SQL here
-- This should revert the changes made in the up migration
-- Example:
-- DROP TABLE IF EXISTS public.your_table;

COMMIT;
```

Edit this file to add your custom SQL for both the up migration (to apply changes) and down migration (to roll back changes).

## Schema-based Migrations

The ORM can also generate migrations by comparing your schema definition to the current state.

### Initializing Schema State

Before generating differential migrations, initialize the schema state:

```bash
npm run migrate:init-state -- --schema-path schema/database.schema
```

### Generating a Migration from Schema

After updating your schema definition, generate a migration:

```bash
npm run migrate:generate -- --name "update schema"
```

This will generate a migration containing only the changes between your current schema and the previous state.

### Options for Schema-based Migrations

| Option | Description |
|--------|-------------|
| `--schema-path <path>` | Path to schema file | 
| `--force-full` | Generate a full migration instead of a diff |
| `--name <name>` | Migration name |
| `--output <path>` | Custom output path for the migration file |

## Best Practices

1. **Always include down migrations**: Make sure to implement the down migration to roll back changes.
2. **Use transactions**: All migrations should be wrapped in transactions (the template does this for you).
3. **Be specific with schema names**: Always qualify table names with schema names.
4. **Test migrations**: Test migrations in a staging environment before production.
5. **Keep migrations small**: Multiple small migrations are better than one large migration.