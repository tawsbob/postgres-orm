# PostgreSQL Schema Management Test Cases

## 1. Extension Management

### 1.1 Adding Extensions
- Add a new extension `pg_trgm` for text search functionality
- Add extension with specific version `hstore (version='1.4')`
- Add multiple extensions in one operation
- Add extension that requires superuser privileges

### 1.2 Removing Extensions
- Remove a non-critical extension
- Attempt to remove a critical extension that other objects depend on
- Remove multiple extensions in one operation

## 2. Enum Management

### 2.1 Adding Enums
- Create a new enum `PaymentMethod` with values `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`
- Create enum with case-sensitive values
- Create enum with special characters in values

### 2.2 Updating Enums
- Add a new value `CRYPTO` to existing enum `PaymentMethod`
- Rename existing enum value (`GUEST` to `VISITOR` in `UserRole`)
- Reorder enum values
- Update value with special characters

### 2.3 Removing Enums
- Remove an unused enum
- Attempt to remove enum that is currently used by a model
- Replace enum with another type and then remove

## 3. Model Management

### 3.1 Adding Models
- Create a simple model `Category` with basic fields
- Create a model with all supported field types
- Create a model with relations to existing models
- Create a model with composite primary key
- Create a model with inheritance

### 3.2 Updating Models
- Rename a model (`Profile` to `UserProfile`)
- Add a new field to existing model
- Change model constraints (unique, check)
- Add index to existing model
- Add composite index

### 3.3 Removing Models
- Remove a model with no dependencies
- Remove a model with cascading effect on related models
- Remove model but preserve data (migration to new structure)

## 4. Field Management

### 4.1 Adding Fields
- Add a required field with default value to existing model
- Add an optional field to existing model
- Add a relation field (foreign key)
- Add a field with constraints (unique, check)
- Add field with custom data type

### 4.2 Updating Fields
- Change field type with compatible conversion (VARCHAR to TEXT)
- Change field type with potential data loss (TEXT to VARCHAR)
- Modify field constraints (add/remove NOT NULL)
- Update default value of a field
- Change field name

### 4.3 Removing Fields
- Remove non-critical field
- Remove primary key field
- Remove foreign key field
- Remove field used in existing views or functions

## 5. Row Level Security Management

### 5.1 Activating RLS
- Enable RLS on a model without existing policies
- Enable RLS with force option on a model
- Enable RLS on a model with existing data
- Enable RLS on a model with relations

### 5.2 Deactivating RLS
- Disable RLS on a model with existing policies
- Disable RLS on a model with dependent views
- Disable force option but keep RLS enabled

## 6. Policy Management

### 6.1 Adding Policies
- Create SELECT-only policy based on user ID
- Create policy for multiple operations (SELECT, INSERT, UPDATE)
- Create policy with complex conditions involving joins
- Create policy with USING and WITH CHECK conditions
- Create row-specific and column-specific policies

### 6.2 Updating Policies
- Change policy condition
- Change policy operations (add DELETE to existing policy)
- Change policy name
- Change target roles for policy

### 6.3 Removing Policies
- Remove a specific policy
- Remove all policies from a table
- Remove policies by operation type

## 7. Role Management

### 7.1 Adding Roles
- Create a basic role with limited privileges
- Create role with inherited permissions
- Create role with specific schema access
- Create application-level role with appropriate permissions

### 7.2 Updating Roles
- Add new privileges to existing role
- Remove privileges from existing role
- Change role name
- Change role ownership
- Add member to role (grant role to user)

### 7.3 Removing Roles
- Remove role with no dependencies
- Remove role and reassign owned objects
- Remove role with cascade option

## 8. Integration Tests

### 8.1 Schema Changes with Active Connections
- Apply schema changes while system has active connections
- Test serialization issues during concurrent schema modifications

### 8.2 Performance Tests
- Measure performance impact of RLS on large tables
- Benchmark before and after adding complex policies
- Test query performance with and without specific extensions

### 8.3 Data Migration
- Test data preservation during model structure changes
- Test data conversion during field type changes
- Test data integrity after removing constraints 