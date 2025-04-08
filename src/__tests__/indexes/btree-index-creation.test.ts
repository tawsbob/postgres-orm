import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Btree Index Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a simple btree index', () => {
    // Create a raw schema with a model that has a btree index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        
        @@index([name], { type: "btree" })
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
    expect(indexStep?.name).toContain('idx_User_name');
    expect(indexStep?.sql).toContain('CREATE INDEX');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('USING btree ("name")');
  });

  test('should generate migration for creating a btree index on multiple columns', () => {
    // Create a raw schema with a model that has a multi-column btree index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        firstName     VARCHAR(100)
        lastName      VARCHAR(100)
        
        @@index([firstName, lastName], { type: "btree" })
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
    expect(indexStep?.name).toContain('idx_User_firstName_lastName');
    expect(indexStep?.sql).toContain('CREATE INDEX');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('USING btree ("firstName", "lastName")');
  });

  test('should generate migration for creating a btree index with explicit index name', () => {
    // Create a raw schema with a model that has a named btree index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        
        @@index([name], { type: "btree", name: "custom_name_idx" })
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
      step => step.type === 'create' && step.objectType === 'index' && step.name === 'custom_name_idx'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.sql).toContain('CREATE INDEX "custom_name_idx"');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('USING btree ("name")');
  });

  test('should default to btree index type when not explicitly specified', () => {
    // Create a raw schema with a model that has an index without explicit type
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        
        @@index([name])
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
    expect(indexStep?.sql).not.toContain('USING btree'); // It seems default indexing doesn't include explicit USING clause
  });
}); 