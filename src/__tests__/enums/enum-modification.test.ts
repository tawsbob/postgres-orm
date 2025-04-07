import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';
import { Schema } from '../../parser/types';

describe('Enum Modification Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for adding new values to an enum', () => {
    // Original schema with a basic enum
    const oldRawSchema = `
      // PostgreSQL Schema Definition
      enum UserRole {
        ADMIN
        USER
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with new enum values
    const newRawSchema = `
      // PostgreSQL Schema Definition
      enum UserRole {
        ADMIN
        USER
        GUEST
        SUPPORT
      }
    `;
    const newSchema = schemaParser.parseSchema(undefined, newRawSchema);

    // Generate the migration by comparing schemas
    const migration = migrationGenerator.generateMigrationFromDiff(oldSchema, newSchema, {
      includeExtensions: false,
      includeEnums: true,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    // PostgreSQL requires dropping and recreating the enum to add new values
    expect(migration.steps.length).toBe(2);
    
    // First step should be to drop the old enum
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('enum');
    expect(migration.steps[0].name).toContain('UserRole');
    expect(migration.steps[0].sql).toContain('DROP TYPE IF EXISTS');
    
    // Second step should be to recreate the enum with all values
    expect(migration.steps[1].type).toBe('create');
    expect(migration.steps[1].objectType).toBe('enum');
    expect(migration.steps[1].name).toBe('UserRole');
    expect(migration.steps[1].sql).toContain("CREATE TYPE");
    expect(migration.steps[1].sql).toContain("'ADMIN', 'USER', 'GUEST', 'SUPPORT'");
  });

  test('should generate migration for modifying multiple enums', () => {
    // Original schema with multiple enums
    const oldRawSchema = `
      // PostgreSQL Schema Definition
      enum UserRole {
        ADMIN
        USER
      }

      enum OrderStatus {
        PENDING
        SHIPPED
        DELIVERED
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with modified enums
    const newRawSchema = `
      // PostgreSQL Schema Definition
      enum UserRole {
        ADMIN
        USER
        GUEST
      }

      enum OrderStatus {
        PENDING
        PROCESSING
        SHIPPED
        DELIVERED
        CANCELLED
      }
    `;
    const newSchema = schemaParser.parseSchema(undefined, newRawSchema);

    // Generate the migration by comparing schemas
    const migration = migrationGenerator.generateMigrationFromDiff(oldSchema, newSchema, {
      includeExtensions: false,
      includeEnums: true,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps for both enums
    expect(migration.steps.length).toBe(4); // 2 drops + 2 recreations
    
    // Get steps for each enum
    const userRoleSteps = migration.steps.filter(step => step.name === 'UserRole' || step.name === 'UserRole_drop');
    const orderStatusSteps = migration.steps.filter(step => step.name === 'OrderStatus' || step.name === 'OrderStatus_drop');
    
    expect(userRoleSteps.length).toBe(2);
    expect(orderStatusSteps.length).toBe(2);
    
    // Check UserRole steps
    const userRoleCreate = userRoleSteps.find(step => step.type === 'create');
    expect(userRoleCreate?.sql).toContain("'ADMIN', 'USER', 'GUEST'");
    
    // Check OrderStatus steps
    const orderStatusCreate = orderStatusSteps.find(step => step.type === 'create');
    expect(orderStatusCreate?.sql).toContain("'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'");
  });
}); 