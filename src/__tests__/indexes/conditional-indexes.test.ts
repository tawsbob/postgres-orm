import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Conditional Index Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a conditional index with a simple WHERE clause', () => {
    // Create a raw schema with a model that has a conditional index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        isActive      BOOLEAN         @default(true)
        
        @@index([name], { where: "isActive = true" })
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
    expect(indexStep?.sql).toContain('WHERE isActive = true');
  });

  test('should generate migration for creating a conditional index with a complex WHERE clause', () => {
    // Create a raw schema with a model that has a conditional index with complex condition
    const rawSchema = `
      model Order {
        id            UUID            @id
        amount        DECIMAL(10,2)
        status        VARCHAR(50)
        createdAt     TIMESTAMP       @default(now())
        
        @@index([status, createdAt], { where: "amount > 1000 AND status = 'COMPLETED'" })
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
    expect(indexStep?.name).toContain('idx_Order_status_createdAt');
    expect(indexStep?.sql).toContain('CREATE INDEX');
    expect(indexStep?.sql).toContain('ON "public"."Order"');
    expect(indexStep?.sql).toContain("WHERE amount > 1000 AND status = 'COMPLETED'");
  });

  test('should generate migration for creating a conditional index with named index', () => {
    // Create a raw schema with a model that has a named conditional index
    const rawSchema = `
      model User {
        id            UUID            @id
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        isActive      BOOLEAN         @default(true)
        
        @@index([name], { 
          where: "isActive = true", 
          name: "active_users_name_idx" 
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
      step => step.type === 'create' && step.objectType === 'index' && step.name === 'active_users_name_idx'
    );

    // Check that the index step exists and has the right properties
    expect(indexStep).toBeDefined();
    expect(indexStep?.sql).toContain('CREATE INDEX "active_users_name_idx"');
    expect(indexStep?.sql).toContain('ON "public"."User"');
    expect(indexStep?.sql).toContain('WHERE isActive = true');
  });

  test('should generate migration for creating a composite conditional index', () => {
    // Create a raw schema with a model that has a composite conditional index
    const rawSchema = `
      model Product {
        id            UUID            @id
        name          VARCHAR(150)
        price         DECIMAL(10,2)
        stock         INTEGER
        isDiscounted  BOOLEAN         @default(false)
        
        @@index([name, price], { where: "stock > 0 AND isDiscounted = true" })
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
    expect(indexStep?.name).toContain('idx_Product_name_price');
    expect(indexStep?.sql).toContain('("name", "price")');
    expect(indexStep?.sql).toContain('WHERE stock > 0 AND isDiscounted = true');
  });
}); 