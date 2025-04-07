import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Field Modification Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for adding a field to existing table', () => {
    // Original schema with a users table
    const originalSchemaContent = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
      }
    `;

    // Updated schema with a new field
    const updatedSchemaContent = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        created_at timestamp @default(now())
      }
    `;

    const originalSchema = schemaParser.parseSchema(undefined, originalSchemaContent);
    const updatedSchema = schemaParser.parseSchema(undefined, updatedSchemaContent);

    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, updatedSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the alter table step that adds a column
    const alterTableSteps = migration.steps.filter(step => 
      step.type === 'alter' && 
      step.objectType === 'table' && 
      step.sql.includes('ADD COLUMN')
    );
    
    expect(alterTableSteps.length).toBeGreaterThanOrEqual(1);
    
    // Check that the added column is created_at
    const addColumnStep = alterTableSteps.find(step => step.sql.includes('"created_at"'));
    expect(addColumnStep).toBeDefined();
    expect(addColumnStep?.sql).toContain('ADD COLUMN "created_at" timestamp');
    expect(addColumnStep?.sql).toContain('DEFAULT now()');
  });

  test('should generate migration for modifying a field type', () => {
    // Original schema with varchar field
    const originalSchemaContent = `
      // PostgreSQL Schema Definition
      model products {
        id uuid pk
        description varchar(100)
      }
    `;

    // Updated schema with text field instead of varchar
    const updatedSchemaContent = `
      // PostgreSQL Schema Definition
      model products {
        id uuid pk
        description text
      }
    `;

    const originalSchema = schemaParser.parseSchema(undefined, originalSchemaContent);
    const updatedSchema = schemaParser.parseSchema(undefined, updatedSchemaContent);

    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, updatedSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the alter table step that alters a column
    const alterTableSteps = migration.steps.filter(step => 
      step.type === 'alter' && 
      step.objectType === 'table' && 
      step.sql.includes('ALTER COLUMN')
    );
    
    expect(alterTableSteps.length).toBeGreaterThanOrEqual(1);
    
    // Check that the column is altered and type is changed
    const alterColumnStep = alterTableSteps.find(step => 
      step.sql.includes('"description"') && 
      step.sql.toLowerCase().includes('type')
    );
    
    expect(alterColumnStep).toBeDefined();
    expect(alterColumnStep?.sql).toContain('ALTER COLUMN "description" TYPE');
    expect(alterColumnStep?.sql).toContain('text');
  });

  test('should generate migration for modifying field constraints', () => {
    // Original schema with non-nullable field
    const originalSchemaContent = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        bio text
      }
    `;

    // Updated schema with nullable field
    const updatedSchemaContent = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        bio? text
      }
    `;

    const originalSchema = schemaParser.parseSchema(undefined, originalSchemaContent);
    const updatedSchema = schemaParser.parseSchema(undefined, updatedSchemaContent);

    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, updatedSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the alter table step that drops not null constraint
    const alterTableSteps = migration.steps.filter(step => 
      step.type === 'alter' && 
      step.objectType === 'table' && 
      step.sql.includes('ALTER COLUMN') &&
      step.sql.includes('DROP NOT NULL')
    );
    
    expect(alterTableSteps.length).toBeGreaterThanOrEqual(1);
    
    // Check that the not null constraint is dropped for bio
    const dropNotNullStep = alterTableSteps.find(step => step.sql.includes('"bio"'));
    expect(dropNotNullStep).toBeDefined();
    expect(dropNotNullStep?.sql).toContain('ALTER COLUMN "bio" DROP NOT NULL');
  });

  test('should generate migration for removing a field from existing table', () => {
    // Original schema with multiple fields
    const originalSchemaContent = `
      // PostgreSQL Schema Definition
      model articles {
        id uuid pk
        title varchar(200)
        content text
        published_at timestamp
        is_published boolean @default(false)
      }
    `;

    // Updated schema with a field removed
    const updatedSchemaContent = `
      // PostgreSQL Schema Definition
      model articles {
        id uuid pk
        title varchar(200)
        content text
        is_published boolean @default(false)
      }
    `;

    const originalSchema = schemaParser.parseSchema(undefined, originalSchemaContent);
    const updatedSchema = schemaParser.parseSchema(undefined, updatedSchemaContent);

    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, updatedSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the alter table step that drops a column
    const alterTableSteps = migration.steps.filter(step => 
      step.type === 'alter' && 
      step.objectType === 'table' && 
      step.sql.includes('DROP COLUMN')
    );
    
    expect(alterTableSteps.length).toBeGreaterThanOrEqual(1);
    
    // Check that the published_at column is dropped
    const dropColumnStep = alterTableSteps.find(step => step.sql.includes('"published_at"'));
    expect(dropColumnStep).toBeDefined();
    expect(dropColumnStep?.sql).toContain('DROP COLUMN IF EXISTS "published_at"');
  });

  test('should generate migration for adding a default value to existing field', () => {
    // Original schema without default value
    const originalSchemaContent = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        is_active boolean
      }
    `;

    // Updated schema with default value
    const updatedSchemaContent = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        is_active boolean @default(true)
      }
    `;

    const originalSchema = schemaParser.parseSchema(undefined, originalSchemaContent);
    const updatedSchema = schemaParser.parseSchema(undefined, updatedSchemaContent);

    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, updatedSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the alter table step that adds default constraint
    const alterTableSteps = migration.steps.filter(step => 
      step.type === 'alter' && 
      step.objectType === 'table' && 
      step.sql.includes('ALTER COLUMN') &&
      step.sql.includes('SET DEFAULT')
    );
    
    expect(alterTableSteps.length).toBeGreaterThanOrEqual(1);
    
    // Check that the default constraint is added for is_active
    const setDefaultStep = alterTableSteps.find(step => step.sql.includes('"is_active"'));
    expect(setDefaultStep).toBeDefined();
    expect(setDefaultStep?.sql).toContain('ALTER COLUMN "is_active" SET DEFAULT true');
  });
}); 