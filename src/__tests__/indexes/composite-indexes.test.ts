import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Composite Index Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a composite index on multiple columns', () => {
    // Create a raw schema with a model that has a composite index
    const rawSchema = `
      model User {
        id            UUID            @id
        firstName     VARCHAR(100)
        lastName      VARCHAR(100)
        email         VARCHAR(255)    @unique
        
        @@index([firstName, lastName])
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
    expect(indexStep?.sql).toContain('("firstName", "lastName")');
  });

  test('should generate migration for creating a composite index with different column ordering', () => {
    // Create a raw schema with a model that has columns in different order
    const rawSchema = `
      model User {
        id            UUID            @id
        lastName      VARCHAR(100)
        firstName     VARCHAR(100)
        email         VARCHAR(255)    @unique
        
        @@index([firstName, lastName])
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
    expect(indexStep?.sql).toContain('("firstName", "lastName")');
    // The index column order should match the order specified in the index declaration,
    // not the order in which columns are defined in the model
  });

  test('should generate migration for creating a composite index with more than two columns', () => {
    // Create a raw schema with a model that has a composite index with three columns
    const rawSchema = `
      model Product {
        id            UUID            @id
        name          VARCHAR(100)
        category      VARCHAR(50)
        subCategory   VARCHAR(50)
        
        @@index([name, category, subCategory])
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
    expect(indexStep?.name).toContain('idx_Product_name_category_subCategory');
    expect(indexStep?.sql).toContain('CREATE INDEX');
    expect(indexStep?.sql).toContain('ON "public"."Product"');
    expect(indexStep?.sql).toContain('("name", "category", "subCategory")');
  });

  test('should generate migration for creating a composite index with a custom name', () => {
    // Create a raw schema with a model that has a named composite index
    const rawSchema = `
      model User {
        id            UUID            @id
        firstName     VARCHAR(100)
        lastName      VARCHAR(100)
        
        @@index([firstName, lastName], { name: "idx_user_names" })
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
      step => step.type === 'create' && step.objectType === 'index' && step.name === 'idx_user_names'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.sql).toContain('CREATE INDEX "idx_user_names"');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('("firstName", "lastName")');
  });
}); 