# Role Orchestrator

The Role Orchestrator is responsible for detecting and managing changes to PostgreSQL roles between schema versions. It provides functionality to:

1. Compare two sets of roles and identify differences (added, removed, updated)
2. Generate migration steps based on those differences

## Architecture

The Role Orchestrator follows a similar pattern to the other orchestrators:

- **Detection:** First, it compares two schemas to detect what has changed
- **Migration Generation:** Then, it generates SQL migration steps for those changes

## Core Components

### RoleDiff

This interface represents the differences between two sets of roles:

```typescript
interface RoleDiff {
  added: Role[];           // Roles that exist in the target schema but not in the source
  removed: Role[];         // Roles that exist in the source schema but not in the target
  updated: {               // Roles that exist in both but have different privileges
    role: Role;
    previousRole: Role;
  }[];
}
```

### RoleOrchestrator

The main class that handles role change detection and migration step generation:

```typescript
class RoleOrchestrator {
  // Compare roles between source and target schemas
  compareRoles(fromRoles: Role[], toRoles: Role[]): RoleDiff;
  
  // Generate migration steps for role differences
  generateRoleMigrationSteps(diff: RoleDiff, schemaName?: string): MigrationStep[];
}
```

## Example Usage

```typescript
// Initialize the orchestrator
const roleOrchestrator = new RoleOrchestrator();

// Compare roles from source and target schemas
const roleDiff = roleOrchestrator.compareRoles(
  sourceSchema.roles,
  targetSchema.roles
);

// Generate migration steps for the differences
const migrationSteps = roleOrchestrator.generateRoleMigrationSteps(roleDiff);
```

## How Role Comparison Works

The role comparison algorithm works as follows:

1. Create maps of roles by name for both source and target schemas
2. Identify added roles (exist in target but not source)
3. Identify removed roles (exist in source but not target)
4. For roles that exist in both, compare their privileges to identify updates

The privilege comparison is thorough and checks:
- If the number of privileges granted has changed
- If the set of tables a role has privileges on has changed
- If the specific privileges (SELECT, INSERT, etc.) have changed for any table

## Migration Step Generation

When generating migration steps, the orchestrator:

1. For added roles:
   - Generates CREATE ROLE statements
   - Generates GRANT statements for each privilege
   - Creates appropriate rollback SQL
   
2. For removed roles:
   - Generates DROP ROLE statements
   - Creates appropriate rollback SQL with CREATE ROLE and GRANT statements
   
3. For updated roles:
   - Drops the existing role
   - Recreates it with the new privileges
   - Generates appropriate rollback SQL
   
Each step includes:
- The SQL command to execute
- The rollback SQL for reversing the change
- Type information ('create', 'drop', or 'alter')
- Object type ('role')
- A unique name for the step

## PostgreSQL Role Management

PostgreSQL roles are global to the database, not schema-scoped. The orchestrator manages:

1. **Role Creation**: Creating database roles
2. **Privilege Management**: Granting appropriate privileges to roles on tables
3. **Schema Awareness**: Ensuring privileges are granted in the correct schema

## Handling Role Dependencies

In PostgreSQL, you may have roles that inherit from other roles. The role orchestrator currently handles only direct privileges and doesn't manage role inheritance. Future enhancements could include:

- Managing role inheritance
- Handling membership in role groups
- Managing default privileges

## Integration with Migration Generator

The Role Orchestrator is used by the MigrationGenerator's `generateMigrationFromDiff` method to handle role changes when comparing schemas.

When creating a new migration or comparing schemas, the MigrationGenerator:

1. Extracts roles from both schemas
2. Uses the RoleOrchestrator to compare and identify differences
3. Generates appropriate migration steps
4. Includes rollback SQL for all changes

## Testing

The role orchestrator has comprehensive tests:

1. **Unit tests**: Test the core functionality of the orchestrator
2. **Integration tests**: Test the integration with the migration generator

Run these tests with:

```bash
npm run test:role:orchestrator    # Unit tests
npm run test:role:integration     # Integration tests
npm run test:role:all             # All role-related tests
``` 