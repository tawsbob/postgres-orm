import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';
import { Schema } from '../../parser/types';

describe('Enum Removal Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for removing an enum', () => {
    // Original schema with an enum
    const oldRawSchema = `
      // PostgreSQL Schema Definition
      enum UserRole {
        ADMIN
        USER
        GUEST
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with the enum removed
    const newRawSchema = `
      // PostgreSQL Schema Definition
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
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('enum');
    expect(migration.steps[0].name).toBe('UserRole');
    expect(migration.steps[0].sql).toContain('DROP TYPE IF EXISTS');
    
    // Check rollback SQL for recreating the enum
    expect(migration.steps[0].rollbackSql).toContain('CREATE TYPE');
    expect(migration.steps[0].rollbackSql).toContain("'ADMIN', 'USER', 'GUEST'");
  });

  test('should generate migration for removing multiple enums', () => {
    // Original schema with multiple enums
    const oldRawSchema = `
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

      enum PaymentType {
        CREDIT
        DEBIT
        TRANSFER
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with all enums removed
    const newRawSchema = `
      // PostgreSQL Schema Definition
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
    expect(migration.steps.length).toBe(3);
    
    // Check for each enum
    const enumNames = migration.steps.map(step => step.name);
    expect(enumNames).toContain('UserRole');
    expect(enumNames).toContain('OrderStatus');
    expect(enumNames).toContain('PaymentType');
    
    // Verify all steps are drop operations
    expect(migration.steps.every(step => step.type === 'drop')).toBe(true);
    expect(migration.steps.every(step => step.objectType === 'enum')).toBe(true);
    
    // Verify SQL for each enum drop
    migration.steps.forEach(step => {
      expect(step.sql).toContain('DROP TYPE IF EXISTS');
      expect(step.rollbackSql).toContain('CREATE TYPE');
    });
    
    // Check specific rollback SQL content
    const userRoleStep = migration.steps.find(step => step.name === 'UserRole');
    expect(userRoleStep?.rollbackSql).toContain("'ADMIN', 'USER', 'GUEST'");
    
    const orderStatusStep = migration.steps.find(step => step.name === 'OrderStatus');
    expect(orderStatusStep?.rollbackSql).toContain("'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'");
    
    const paymentTypeStep = migration.steps.find(step => step.name === 'PaymentType');
    expect(paymentTypeStep?.rollbackSql).toContain("'CREDIT', 'DEBIT', 'TRANSFER'");
  });

  test('should generate migration for selectively removing enums', () => {
    // Original schema with multiple enums
    const oldRawSchema = `
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
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with one enum removed
    const newRawSchema = `
      // PostgreSQL Schema Definition
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

    // Check that the migration contains the right step
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('enum');
    expect(migration.steps[0].name).toBe('UserRole');
    expect(migration.steps[0].sql).toContain('DROP TYPE IF EXISTS');
    expect(migration.steps[0].rollbackSql).toContain("'ADMIN', 'USER', 'GUEST'");
  });
}); 