import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Unique Index Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a simple unique index', () => {
    // Create a raw schema with a model that has a unique index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)
        username      VARCHAR(50)
        
        @@index([email], { unique: true })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index creation step
    const indexStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.name).toContain('idx_User_email');
    expect(indexStep?.sql).toContain('CREATE UNIQUE INDEX');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('("email")');
  });

  test('should generate migration for creating a composite unique index', () => {
    // Create a raw schema with a model that has a composite unique index
    const rawSchema = `
      model Product {
        id            UUID            @id
        sku           VARCHAR(50)
        warehouseId   VARCHAR(50)
        
        @@index([sku, warehouseId], { unique: true })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index creation step
    const indexStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.name).toContain('idx_Product_sku_warehouseId');
    expect(indexStep?.sql).toContain('CREATE UNIQUE INDEX');
    expect(indexStep?.sql).toContain('ON "public"."Product"');
    expect(indexStep?.sql).toContain('("sku", "warehouseId")');
  });

  test('should generate migration for creating a unique index with a custom name', () => {
    // Create a raw schema with a model that has a named unique index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)
        
        @@index([email], { unique: true, name: "unique_email_idx" })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index creation step
    const indexStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index' && step.name === 'unique_email_idx'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.sql).toContain('CREATE UNIQUE INDEX "unique_email_idx"');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('("email")');
  });

  test('should generate migration for creating a conditional unique index', () => {
    // Create a raw schema with a model that has a conditional unique index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)
        role          VARCHAR(50)
        
        @@index([email], { 
          unique: true, 
          where: "role = 'PUBLIC'" 
        })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index creation step
    const indexStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.name).toContain('idx_User_email');
    expect(indexStep?.sql).toContain('CREATE UNIQUE INDEX');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('("email")');
    expect(indexStep?.sql).toContain("WHERE role = 'PUBLIC'");
  });
}); 