import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Enum Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a simple enum', () => {
    // Create a raw schema with a simple enum
    const rawSchema = `
      // PostgreSQL Schema Definition
      enum UserRole {
        ADMIN
        USER
        GUEST
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: true,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].objectType).toBe('enum');
    expect(migration.steps[0].name).toBe('UserRole');
    expect(migration.steps[0].sql).toContain("CREATE TYPE");
    expect(migration.steps[0].sql).toContain("'ADMIN', 'USER', 'GUEST'");
  });

  test('should generate migration for creating an enum with multi-word values', () => {
    // Create a raw schema with an enum with multi-word values
    const rawSchema = `
      // PostgreSQL Schema Definition
      enum OrderStatus {
        PAYMENT_PENDING
        PROCESSING_ORDER
        READY_TO_SHIP
        IN_TRANSIT
        DELIVERED
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: true,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].objectType).toBe('enum');
    expect(migration.steps[0].name).toBe('OrderStatus');
    expect(migration.steps[0].sql).toContain("CREATE TYPE");
    expect(migration.steps[0].sql).toContain("'PAYMENT_PENDING', 'PROCESSING_ORDER', 'READY_TO_SHIP', 'IN_TRANSIT', 'DELIVERED'");
  });

  test('should generate migration for creating multiple enums', () => {
    // Create a raw schema with multiple enums
    const rawSchema = `
      // PostgreSQL Schema Definition
      enum UserRole {
        ADMIN
        USER
        GUEST
      }

      enum PaymentMethod {
        CREDIT_CARD
        DEBIT_CARD
        BANK_TRANSFER
        CASH
      }

      enum OrderStatus {
        PENDING
        SHIPPED
        DELIVERED
        CANCELLED
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
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
    expect(enumNames).toContain('PaymentMethod');
    expect(enumNames).toContain('OrderStatus');
    
    // Verify SQL for each enum
    const userRoleStep = migration.steps.find(step => step.name === 'UserRole');
    expect(userRoleStep?.sql).toContain("'ADMIN', 'USER', 'GUEST'");
    
    const paymentMethodStep = migration.steps.find(step => step.name === 'PaymentMethod');
    expect(paymentMethodStep?.sql).toContain("'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CASH'");
    
    const orderStatusStep = migration.steps.find(step => step.name === 'OrderStatus');
    expect(orderStatusStep?.sql).toContain("'PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'");
  });
}); 