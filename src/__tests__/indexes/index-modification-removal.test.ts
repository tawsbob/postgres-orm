import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Index Modification and Removal Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for index removal', () => {
    // Create source schema with an index
    const sourceSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        
        @@index([name])
      }
    `;

    // Create target schema without the index
    const targetSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
      }
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, sourceSchema);
    const toSchema = schemaParser.parseSchema(undefined, targetSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index drop step
    const indexStep = migration.steps.find(
      step => step.type === 'drop' && step.objectType === 'index'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.name).toContain('idx_User_name');
    expect(indexStep?.sql).toContain('DROP INDEX');
    expect(indexStep?.sql).toContain('"public"."idx_User_name"');
  });

  test('should generate migration for index modification - changing uniqueness', () => {
    // Create source schema with a non-unique index
    const sourceSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        
        @@index([name])
      }
    `;

    // Create target schema with a unique index
    const targetSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        
        @@index([name], { unique: true })
      }
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, sourceSchema);
    const toSchema = schemaParser.parseSchema(undefined, targetSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index drop and create steps
    const dropStep = migration.steps.find(
      step => step.type === 'drop' && step.objectType === 'index'
    );
    const createStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index'
    );

    // Check that the steps exist with the right properties
    expect(dropStep).toBeDefined();
    expect(createStep).toBeDefined();
    expect(dropStep?.name).toContain('idx_User_name');
    expect(createStep?.name).toContain('idx_User_name');
    expect(createStep?.sql).toContain('CREATE UNIQUE INDEX');
  });

  test('should generate migration for index modification - adding condition', () => {
    // Create source schema with a regular index
    const sourceSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        isActive      BOOLEAN         @default(true)
        
        @@index([name])
      }
    `;

    // Create target schema with a conditional index
    const targetSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        isActive      BOOLEAN         @default(true)
        
        @@index([name], { where: "isActive = true" })
      }
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, sourceSchema);
    const toSchema = schemaParser.parseSchema(undefined, targetSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index drop and create steps
    const dropStep = migration.steps.find(
      step => step.type === 'drop' && step.objectType === 'index'
    );
    const createStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index'
    );

    // Check that the steps exist with the right properties
    expect(dropStep).toBeDefined();
    expect(createStep).toBeDefined();
    expect(createStep?.sql).toContain('WHERE isActive = true');
  });

  test('should generate migration for index modification - changing columns', () => {
    // Create source schema with an index on one column
    const sourceSchema = `
      model User {
        id            UUID            @id
        firstName     VARCHAR(100)
        lastName      VARCHAR(100)
        
        @@index([firstName])
      }
    `;

    // Create target schema with an index on multiple columns
    const targetSchema = `
      model User {
        id            UUID            @id
        firstName     VARCHAR(100)
        lastName      VARCHAR(100)
        
        @@index([firstName, lastName])
      }
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, sourceSchema);
    const toSchema = schemaParser.parseSchema(undefined, targetSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index drop and create steps
    const dropStep = migration.steps.find(
      step => step.type === 'drop' && step.objectType === 'index'
    );
    const createStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index'
    );

    // Check that the steps exist with the right properties
    expect(dropStep).toBeDefined();
    expect(createStep).toBeDefined();
    expect(dropStep?.name).toContain('idx_User_firstName');
    expect(createStep?.name).toContain('idx_User_firstName_lastName');
    expect(createStep?.sql).toContain('("firstName", "lastName")');
  });

  test('should generate migration for index modification - changing index name', () => {
    // Create source schema with a default named index
    const sourceSchema = `
      model User {
        id            UUID            @id
        name          VARCHAR(150)
        
        @@index([name])
      }
    `;

    // Create target schema with a custom named index
    const targetSchema = `
      model User {
        id            UUID            @id
        name          VARCHAR(150)
        
        @@index([name], { name: "custom_name_idx" })
      }
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, sourceSchema);
    const toSchema = schemaParser.parseSchema(undefined, targetSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the index drop and create steps
    const dropStep = migration.steps.find(
      step => step.type === 'drop' && step.objectType === 'index'
    );
    const createStep = migration.steps.find(
      step => step.type === 'create' && step.objectType === 'index' && step.name === 'custom_name_idx'
    );

    // Check that the steps exist with the right properties
    expect(dropStep).toBeDefined();
    expect(createStep).toBeDefined();
    expect(dropStep?.name).toContain('idx_User_name');
    expect(createStep?.sql).toContain('CREATE INDEX "custom_name_idx"');
  });
}); 