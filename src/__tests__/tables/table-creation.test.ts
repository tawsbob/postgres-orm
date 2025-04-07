import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Table Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a simple table with basic fields', () => {
    // Create a raw schema with a simple table
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        email VARCHAR(255) @unique
        createdAt TIMESTAMP @default(now())
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

    // Find all table creation steps
    const tableSteps = migration.steps.filter(step => 
      step.type === 'create' && step.objectType === 'table'
    );
    
    // Check that we have a table creation step
    expect(tableSteps.length).toBe(1);
    const tableStep = tableSteps[0];
    expect(tableStep.name).toBe('User');
    expect(tableStep.sql).toContain('CREATE TABLE');
    expect(tableStep.sql).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(tableStep.sql).toContain('"name" VARCHAR(255)');
    expect(tableStep.sql).toContain('"email" VARCHAR(255) UNIQUE');
    expect(tableStep.sql).toContain('"createdAt" TIMESTAMP DEFAULT now()');
  });

  test('should generate migration for creating a table with all supported data types', () => {
    // Create a raw schema with all PostgreSQL data types
    const rawSchema = `
      // PostgreSQL Schema Definition
      enum Status {
        ACTIVE
        INACTIVE
        PENDING
      }

      model AllTypes {
        id UUID @id @default(gen_random_uuid())
        uuidField UUID
        varcharField VARCHAR(100)
        textField TEXT
        smallIntField SMALLINT
        integerField INTEGER
        serialField SERIAL
        booleanField BOOLEAN
        timestampField TIMESTAMP
        decimalField DECIMAL(10,2)
        jsonbField JSONB
        pointField POINT
        enumField Status
        textArrayField TEXT[]
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: true,
      includeTables: true,
      includeRoles: false
    });

    // There should be steps for enum and table
    expect(migration.steps.length).toBeGreaterThanOrEqual(2);
    
    // Find the table step
    const tableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'AllTypes'
    );
    expect(tableStep).toBeDefined();
    
    // Check all the data types in the SQL
    expect(tableStep?.sql).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(tableStep?.sql).toContain('"uuidField" UUID');
    expect(tableStep?.sql).toContain('"varcharField" VARCHAR(100)');
    expect(tableStep?.sql).toContain('"textField" TEXT');
    expect(tableStep?.sql).toContain('"smallIntField" SMALLINT');
    expect(tableStep?.sql).toContain('"integerField" INTEGER');
    expect(tableStep?.sql).toContain('"serialField" SERIAL');
    expect(tableStep?.sql).toContain('"booleanField" BOOLEAN');
    expect(tableStep?.sql).toContain('"timestampField" TIMESTAMP');
    expect(tableStep?.sql).toContain('"decimalField" DECIMAL(10,2)');
    expect(tableStep?.sql).toContain('"jsonbField" JSONB');
    expect(tableStep?.sql).toContain('"pointField" POINT');
    expect(tableStep?.sql).toContain('"enumField" "public"."Status"');
    expect(tableStep?.sql).toContain('"textArrayField" TEXT[]');
  });

  test('should generate migration for creating a table with default values', () => {
    // Create a raw schema with default values
    const rawSchema = `
      // PostgreSQL Schema Definition
      model DefaultValues {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255) @default("Anonymous")
        createdAt TIMESTAMP @default(now())
        isActive BOOLEAN @default(true)
        counter INTEGER @default(0)
        decimals DECIMAL(8,2) @default(10.5)
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

    // Find the table creation step
    const tableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'DefaultValues'
    );
    expect(tableStep).toBeDefined();
    
    // Check default values in the SQL
    expect(tableStep?.sql).toContain('DEFAULT gen_random_uuid()');
    expect(tableStep?.sql).toContain('DEFAULT "Anonymous"');
    expect(tableStep?.sql).toContain('DEFAULT now()');
    expect(tableStep?.sql).toContain('DEFAULT true');
    expect(tableStep?.sql).toContain('DEFAULT 0');
    expect(tableStep?.sql).toContain('DEFAULT 10.5');
  });

  test('should generate migration for creating a table with constraints', () => {
    // Create a raw schema with constraints
    const rawSchema = `
      // PostgreSQL Schema Definition
      model ConstraintsTable {
        id UUID @id @default(gen_random_uuid())
        username VARCHAR(50) @unique
        email VARCHAR(100) @unique
        age INTEGER
        salary DECIMAL(10,2)
        requiredField TEXT @notNull
        optionalField TEXT
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeConstraints: true,
      includeRoles: false
    });

    // Find the table creation step
    const tableSteps = migration.steps.filter(step => 
      step.type === 'create' && step.objectType === 'table'
    );
    expect(tableSteps.length).toBe(1);
    
    const sql = tableSteps[0].sql;
    
    // Check constraints in the SQL
    expect(sql).toContain('"username" VARCHAR(50) UNIQUE NOT NULL');
    expect(sql).toContain('"email" VARCHAR(100) UNIQUE NOT NULL');
    expect(sql).toContain('"age" INTEGER NOT NULL');
    expect(sql).toContain('"salary" DECIMAL(10,2) NOT NULL');
    expect(sql).toContain('"requiredField" TEXT NOT NULL');
    expect(sql).toContain('"optionalField" TEXT');
  });

  test('should generate migration for creating multiple tables', () => {
    // Create a raw schema with multiple tables
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        email VARCHAR(255) @unique
      }

      model Product {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        price DECIMAL(10,2)
        inStock BOOLEAN @default(true)
      }

      model Order {
        id UUID @id @default(gen_random_uuid())
        orderDate TIMESTAMP @default(now())
        status VARCHAR(50)
        total DECIMAL(10,2)
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

    // Get all table creation steps
    const tableSteps = migration.steps.filter(step => 
      step.type === 'create' && step.objectType === 'table'
    );
    
    // Check that there are 3 table creation steps
    expect(tableSteps.length).toBe(3);
    
    // Check for each table
    const tableNames = tableSteps.map(step => step.name);
    expect(tableNames).toContain('User');
    expect(tableNames).toContain('Product');
    expect(tableNames).toContain('Order');
    
    // Verify all steps are table creations
    expect(tableSteps.every(step => step.type === 'create')).toBe(true);
    expect(tableSteps.every(step => step.objectType === 'table')).toBe(true);
  });
}); 