import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Field Default Values Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for UUID field with gen_random_uuid() default', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk @default(gen_random_uuid())
        username varchar(100)
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('users');
    expect(migration.steps[0].sql).toContain('DEFAULT gen_random_uuid()');
  });

  test('should generate migration for TIMESTAMP field with now() default', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model events {
        id uuid pk @default(gen_random_uuid())
        created_at timestamp @default(now())
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('events');
    expect(migration.steps[0].sql).toContain('DEFAULT now()');
  });

  test('should generate migration for VARCHAR field with string literal default', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk @default(gen_random_uuid())
        status varchar(20) @default("active")
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('users');
    expect(migration.steps[0].sql).toContain('DEFAULT "active"');
  });

  test('should generate migration for INTEGER field with numeric literal default', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model products {
        id uuid pk @default(gen_random_uuid())
        quantity integer @default(0)
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('products');
    expect(migration.steps[0].sql).toContain('DEFAULT 0');
  });

  test('should generate migration for DECIMAL field with decimal literal default', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model products {
        id uuid pk @default(gen_random_uuid())
        price decimal(10,2) @default(9.99)
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('products');
    expect(migration.steps[0].sql).toContain('DEFAULT 9.99');
  });

  test('should generate migration for BOOLEAN field with boolean literal default', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk @default(gen_random_uuid())
        is_active boolean @default(true)
        is_deleted boolean @default(false)
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('users');
    expect(migration.steps[0].sql).toContain('DEFAULT true');
    expect(migration.steps[0].sql).toContain('DEFAULT false');
  });

  test('should generate migration for multiple fields with different default values', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model orders {
        id uuid pk @default(gen_random_uuid())
        order_number serial
        created_at timestamp @default(now())
        status varchar(20) @default("pending")
        total_amount decimal(10,2) @default(0.00)
        is_paid boolean @default(false)
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('orders');
    
    const sql = migration.steps[0].sql;
    expect(sql).toContain('DEFAULT gen_random_uuid()');
    expect(sql).toContain('DEFAULT now()');
    expect(sql).toContain('DEFAULT "pending"');
    expect(sql).toContain('DEFAULT 0.00');
    expect(sql).toContain('DEFAULT false');
  });
}); 