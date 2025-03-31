# PostgreSQL ORM

A lightweight PostgreSQL ORM with schema parsing capabilities, inspired by Prisma.

## Features

- Schema parsing with support for:
  - PostgreSQL native types (UUID, VARCHAR, TEXT, etc.)
  - Enums
  - Relationships (one-to-one, one-to-many, many-to-many)
  - Field attributes (id, unique, default)
  - JSON fields
  - Array types
  - Custom types
- Migration generation
- Migration preview functionality

## Installation

```bash
npm install postgres-orm
```

## Usage

1. Create a schema file (e.g., `schema/database.schema`):

```schema
enum UserRole {
  ADMIN
  USER
  GUEST
}

model User {
  id        UUID      @id @default(uuid())
  email     VARCHAR(255) @unique
  name      VARCHAR(100)
  role      UserRole  @default(USER)
  profile   Profile?  @relation("UserProfile")
  orders    Order[]
}
```

2. Parse the schema:

```typescript
import { SchemaParser } from 'postgres-orm';

const parser = new SchemaParser();
const schema = parser.parseSchema('schema/database.schema');

// Access parsed schema
console.log(schema.models);
console.log(schema.enums);
```

## Schema Syntax

### Models

Models are defined using the `model` keyword:

```schema
model ModelName {
  fieldName FieldType @attribute
}
```

### Fields

Fields can have the following attributes:
- `@id`: Primary key
- `@unique`: Unique constraint
- `@default(value)`: Default value

### Relationships

Relationships are defined using the `@relation` attribute:

```schema
model User {
  profile Profile? @relation("UserProfile")
}

model Profile {
  user User @relation("UserProfile", fields: [userId], references: [id])
}
```

### Enums

Enums are defined using the `enum` keyword:

```schema
enum EnumName {
  VALUE1
  VALUE2
  VALUE3
}
```

## Migration Previews

You can preview the SQL migrations that would be generated from your schema without actually writing them to disk:

```bash
# Default preview (pretty-printed format)
npm run preview:migration

# JSON format
npm run preview:migration:json

# Raw SQL format
npm run preview:migration:sql

# Output to file
npm run preview:migration:file

# View all options
npm run preview:migration:help
```

### Custom Preview Options

The migration preview tool supports various command-line options:

```bash
# Specify a custom schema file
npm run preview:migration -- --schema schema/custom-schema.schema

# Specify an output file
npm run preview:migration -- --output custom-output.sql

# Change the output format
npm run preview:migration -- --format [pretty|json|raw]

# Exclude specific parts from the preview
npm run preview:migration -- --no-down --no-stats
npm run preview:migration -- --no-extensions --no-roles
```

### Programmatic Usage

You can also use the preview functionality programmatically:

```typescript
import { previewMigration, MigrationPreviewOptions } from 'postgres-orm';

const options: MigrationPreviewOptions = {
  format: 'json',
  showDownMigration: false,
  includeExtensions: true,
  // ... other options
};

previewMigration('schema/database.schema', options, 'output.json');
```

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Preview schema:
   ```bash
   npm run preview
   ```
6. Preview migrations:
   ```bash
   npm run preview:migration
   ```

## License

MIT