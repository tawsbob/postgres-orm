# PostgreSQL ORM Schema Syntax

This document provides a comprehensive reference for the PostgreSQL ORM schema definition syntax. The schema definition language allows you to define your database structure in a declarative way, including tables (models), enums, extensions, row-level security policies, and roles.

## Table of Contents

- [Extensions](#extensions)
- [Enums](#enums)
- [Models](#models)
  - [Fields](#fields)
  - [Field Attributes](#field-attributes)
  - [Default Values](#default-values)
  - [Relations](#relations)
- [Row Level Security](#row-level-security)
  - [Policies](#policies)
- [Roles](#roles)
- [Complete Example](#complete-example)

## Extensions

Extensions add additional functionality to PostgreSQL. To add an extension to your database:

```
extension extension_name
```

You can optionally specify a version:

```
extension extension_name (version='1.0')
```

### Extension Versioning

When specifying the version of an extension, you can control which version of the extension is installed. This is particularly useful when:

1. **Compatibility Requirements**: Your application may rely on specific behaviors or functions in a particular extension version.
2. **Stability**: Pinning to a known-good version prevents unexpected changes when PostgreSQL is upgraded.
3. **Testing**: You can test your application against different extension versions before upgrading in production.

The version syntax follows PostgreSQL's extension versioning:

```
extension extension_name (version='1.0')
extension postgis (version='3.1.4')
extension pg_trgm (version='1.6')
```

If no version is specified, PostgreSQL will use the default version, which is typically the latest version compatible with your PostgreSQL instance.

Common extensions include:
- `pgcrypto` - For cryptographic functions
- `postgis` - For geographic objects
- `uuid-ossp` - For UUID generation functions

## Enums

Enums define a set of fixed values that a field can have. The syntax is:

```
enum EnumName {
  VALUE1
  VALUE2
  VALUE3
}
```

Example:
```
enum UserRole {
  ADMIN
  USER
  PUBLIC
}
```

Enum values are case-sensitive and should be written in uppercase by convention.

## Models

Models represent database tables. The syntax is:

```
model ModelName {
  field1        FieldType        @attribute1 @attribute2
  field2        FieldType        @attribute
  relationField RelatedModel     @relation(fields: [localField], references: [foreignField])
  
  @@index([field1, field2])
  @@unique([field1, field2])
}
```

Example:
```
model User {
  id            UUID            @id @default(gen_random_uuid())
  email         VARCHAR(255)    @unique
  name          VARCHAR(150)
  orders        Order[]
}
```

### Fields

Fields define the columns in your table. The syntax is:

```
fieldName  FieldType(length,scale)  @attribute1 @attribute2  @default(value)
```

Field components:
- **fieldName**: The name of the column (in camelCase by convention)
- **FieldType**: The PostgreSQL data type
- **length/precision**: For types that need length specification (e.g., VARCHAR(255))
- **scale**: For decimal types (e.g., DECIMAL(10,2))
- **attributes**: Special modifiers like @id, @unique, etc.
- **default value**: Default value for the field

#### Common Field Types

- Text types: `VARCHAR`, `TEXT`, `CHAR`
- Numeric types: `INTEGER`, `SMALLINT`, `BIGINT`, `DECIMAL`, `FLOAT`
- Boolean: `BOOLEAN`
- Date/Time: `TIMESTAMP`, `DATE`, `TIME`
- JSON types: `JSON`, `JSONB`
- Binary: `BYTEA`
- UUID: `UUID`
- Geometric: `POINT`, `LINE`, `POLYGON` (requires postgis extension)
- Arrays: Any type followed by `[]` (e.g., `INTEGER[]`)
- Enum types: Any defined enum name

### Field Attributes

Attributes modify the behavior of fields:

- `@id` - Marks the field as the primary key
- `@unique` - Adds a unique constraint
- `@default(value)` - Sets a default value
- `@updatedAt` - Automatically updates the timestamp when the record changes
- `@relation` - Defines a relationship between models

### Default Values

Default values can use PostgreSQL functions:

```
createdAt  TIMESTAMP  @default(now())
uuid       UUID       @default(gen_random_uuid())
```

### Relations

Relations define how models are connected to each other:

```
// One-to-one relation
profile       Profile?        @relation("UserProfile")

// One-to-many relation
orders        Order[]         

// Many-to-one relation
user          User            @relation(fields: [userId], references: [id])

// Many-to-many relation
products      ProductOrder[]
```

The relation types are:
- One-to-one: A model has exactly one of another model
- One-to-many: A model has multiple instances of another model
- Many-to-one: Multiple models have the same instance of another model
- Many-to-many: Multiple models have multiple instances of another model

## Row Level Security

Row Level Security (RLS) restricts which rows users can access. To enable RLS on a model:

```
model User {
  // ...fields...

  @@rowLevelSecurity(enabled: true, force: true)
}
```

Options:
- `enabled`: Turns on RLS for the table
- `force`: Forces RLS for the table owner as well

### Policies

Policies define the conditions under which users can access rows:

```
@@policy("policyName", {
  for: ["select", "update", "delete", "insert"],
  to: "roleName",
  using: "condition_expression"
})
```

Parameters:
- `policyName`: A unique name for the policy
- `for`: The operations this policy applies to (select, update, delete, insert)
- `to`: The role this policy applies to
- `using`: The condition that must be true for the operation to be allowed

Example:
```
@@policy("userIsolation", {
  for: ["select", "update"],
  to: "authenticated",
  using: "(user_id = auth.uid())"
})

@@policy("adminAccess", {
  for: "all",
  to: "admin",
  using: "true"
})
```

## Roles

Roles define database users or groups with specific permissions:

```
role RoleName {
  privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"] on TableName
}
```

Example:
```
role adminRole {
  privileges: ["ALL"] on User
  privileges: ["SELECT", "UPDATE"] on Profile
}
```

Parameters:
- `RoleName`: The name of the role
- `privileges`: List of allowed operations
- `on`: The target table or "ALL TABLES"

## Complete Example

Here's a complete schema example demonstrating the key concepts:

```
// Extensions
extension pgcrypto
extension postgis
extension uuid-ossp

// Enums
enum UserRole {
  ADMIN
  USER
  PUBLIC
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

// Models
model User {
  id            UUID            @id @default(gen_random_uuid())
  email         VARCHAR(255)    @unique
  name          VARCHAR(150)
  role          UserRole        @default(USER)
  age           SMALLINT
  balance       INTEGER
  isActive      BOOLEAN         @default(true)
  createdAt     TIMESTAMP       @default(now())
  updatedAt     TIMESTAMP       @updatedAt
  profile       Profile?        @relation("UserProfile")
  orders        Order[]

  @@rowLevelSecurity(enabled: true, force: true)

  @@policy("userIsolation", {
    for: ["select", "update"],
    to: "authenticated",
    using: "(id = auth.uid())"
  })

  @@policy("adminAccess", {
    for: "all",
    to: "adminRole",
    using: "true"
  })
}

model Profile {
  id            UUID            @id @default(gen_random_uuid())
  userId        UUID            @unique
  bio           TEXT
  avatar        VARCHAR(255)
  location      POINT
  user          User            @relation("UserProfile", fields: [userId], references: [id])
}

model Order {
  id            UUID            @id @default(gen_random_uuid())
  userId        UUID
  status        OrderStatus     @default(PENDING)
  totalAmount   DECIMAL(10,2)
  items         JSONB
  createdAt     TIMESTAMP       @default(now())
  updatedAt     TIMESTAMP       @updatedAt
  user          User            @relation(fields: [userId], references: [id])
  products      ProductOrder[]
}

// Roles
role adminRole {
  privileges: ["ALL"] on User
  privileges: ["ALL"] on Profile
  privileges: ["ALL"] on Order
}

role userRole {
  privileges: ["SELECT", "UPDATE"] on User
  privileges: ["SELECT", "INSERT", "UPDATE"] on Profile
  privileges: ["SELECT", "INSERT"] on Order
}
``` 