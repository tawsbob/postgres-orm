import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('One-to-Many Relation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for one-to-many relation between User and Order', () => {
    // Create a raw schema with a one-to-many relation
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        orders        Order[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        totalAmount   DECIMAL(10,2)
        user          User            @relation(fields: [userId], references: [id])
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

    // Find the table creation steps
    const userTableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'User');
    const orderTableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'Order');
    
    // Verify user table creation
    expect(userTableStep).toBeDefined();
    expect(userTableStep?.sql).toContain('CREATE TABLE');
    expect(userTableStep?.sql).toContain('"id" UUID PRIMARY KEY');
    
    // Verify order table creation
    expect(orderTableStep).toBeDefined();
    expect(orderTableStep?.sql).toContain('CREATE TABLE');
    expect(orderTableStep?.sql).toContain('"id" UUID PRIMARY KEY');
    expect(orderTableStep?.sql).toContain('"userId" UUID');
    expect(orderTableStep?.sql).toContain('"totalAmount" DECIMAL(10,2)');
    
    // Find the foreign key constraint step
    const fkStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint');
    
    // Verify foreign key constraint
    expect(fkStep).toBeDefined();
    expect(fkStep?.sql).toContain('ALTER TABLE');
    expect(fkStep?.sql).toContain('ADD CONSTRAINT');
    expect(fkStep?.sql).toContain('FOREIGN KEY ("userId")');
    expect(fkStep?.sql).toContain('REFERENCES');
  });

  test('should generate migration for nested one-to-many relations', () => {
    // Create a raw schema with nested one-to-many relations
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        orders        Order[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        totalAmount   DECIMAL(10,2)
        user          User            @relation(fields: [userId], references: [id])
        items         OrderItem[]
      }

      model OrderItem {
        id            UUID            @id @default(gen_random_uuid())
        orderId       UUID
        name          VARCHAR(100)
        quantity      INTEGER
        price         DECIMAL(10,2)
        order         Order           @relation(fields: [orderId], references: [id])
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

    // Find the foreign key constraint steps
    const fkSteps = migration.steps.filter(step => 
      step.type === 'create' && step.objectType === 'constraint');
    
    // Verify we have two foreign key constraints
    expect(fkSteps.length).toBeGreaterThanOrEqual(2);
    
    // Check for User-Order constraint
    const userOrderFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("userId")'));
    expect(userOrderFk).toBeDefined();
    expect(userOrderFk?.sql).toContain('REFERENCES');
    expect(userOrderFk?.sql).toContain('"User"');
    
    // Check for Order-OrderItem constraint
    const orderItemFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("orderId")'));
    expect(orderItemFk).toBeDefined();
    expect(orderItemFk?.sql).toContain('REFERENCES');
    expect(orderItemFk?.sql).toContain('"Order"');
  });

  test('should generate migration for one-to-many relation with onDelete CASCADE', () => {
    // Create a raw schema with one-to-many relation and CASCADE delete
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        orders        Order[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        totalAmount   DECIMAL(10,2)
        user          User            @relation(fields: [userId], references: [id], onDelete: "CASCADE")
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

    // Find the foreign key constraint step
    const fkStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint' && 
      step.sql.includes('FOREIGN KEY ("userId")'));
    
    // Verify CASCADE behavior
    expect(fkStep).toBeDefined();
    expect(fkStep?.sql).toContain('ON DELETE CASCADE');
  });

  test('should generate migration for one-to-many relation with onUpdate SET NULL', () => {
    // Create a raw schema with one-to-many relation and SET NULL update
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        orders        Order[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        totalAmount   DECIMAL(10,2)
        user          User            @relation(fields: [userId], references: [id], onUpdate: "SET NULL")
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

    // Find the foreign key constraint step
    const fkStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint' && 
      step.sql.includes('FOREIGN KEY ("userId")'));
    
    // Verify SET NULL behavior
    expect(fkStep).toBeDefined();
    expect(fkStep?.sql).toContain('ON UPDATE SET NULL');
  });
}); 