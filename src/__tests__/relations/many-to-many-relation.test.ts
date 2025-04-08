import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Many-to-Many Relation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for many-to-many relation between Product and Order via ProductOrder', () => {
    // Create a raw schema with a many-to-many relation
    const rawSchema = `
      // PostgreSQL Schema Definition
      model Product {
        id            UUID            @id @default(gen_random_uuid())
        name          VARCHAR(255)
        price         DECIMAL(10,2)
        stock         INTEGER
        orders        ProductOrder[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        orderDate     TIMESTAMP       @default(now())
        products      ProductOrder[]
      }

      model ProductOrder {
        id            SERIAL          @id
        orderId       UUID
        productId     UUID
        quantity      INTEGER
        price         DECIMAL(10,2)
        order         Order           @relation(fields: [orderId], references: [id])
        product       Product         @relation(fields: [productId], references: [id])
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
    const productTableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'Product');
    const orderTableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'Order');
    const joinTableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'ProductOrder');
    
    // Verify table creation
    expect(productTableStep).toBeDefined();
    expect(orderTableStep).toBeDefined();
    expect(joinTableStep).toBeDefined();
    
    // Verify join table fields
    expect(joinTableStep?.sql).toContain('"orderId" UUID');
    expect(joinTableStep?.sql).toContain('"productId" UUID');
    
    // Find the foreign key constraint steps
    const fkSteps = migration.steps.filter(step => 
      step.type === 'create' && step.objectType === 'constraint');
    
    // Verify both foreign key constraints exist
    expect(fkSteps.length).toBeGreaterThanOrEqual(2);
    
    // Check for ProductOrder-Order constraint
    const orderFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("orderId")'));
    expect(orderFk).toBeDefined();
    expect(orderFk?.sql).toContain('REFERENCES');
    expect(orderFk?.sql).toContain('"Order"');
    
    // Check for ProductOrder-Product constraint
    const productFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("productId")'));
    expect(productFk).toBeDefined();
    expect(productFk?.sql).toContain('REFERENCES');
    expect(productFk?.sql).toContain('"Product"');
  });

  test('should generate migration for many-to-many relation with cascade delete', () => {
    // Create a raw schema with a many-to-many relation and cascade delete
    const rawSchema = `
      // PostgreSQL Schema Definition
      model Product {
        id            UUID            @id @default(gen_random_uuid())
        name          VARCHAR(255)
        price         DECIMAL(10,2)
        stock         INTEGER
        orders        ProductOrder[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        orderDate     TIMESTAMP       @default(now())
        products      ProductOrder[]
      }

      model ProductOrder {
        id            SERIAL          @id
        orderId       UUID
        productId     UUID
        quantity      INTEGER
        price         DECIMAL(10,2)
        order         Order           @relation(fields: [orderId], references: [id], onDelete: "CASCADE")
        product       Product         @relation(fields: [productId], references: [id], onDelete: "CASCADE")
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
    
    // Check for cascade delete on Order relation
    const orderFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("orderId")'));
    expect(orderFk).toBeDefined();
    expect(orderFk?.sql).toContain('ON DELETE CASCADE');
    
    // Check for cascade delete on Product relation
    const productFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("productId")'));
    expect(productFk).toBeDefined();
    expect(productFk?.sql).toContain('ON DELETE CASCADE');
  });

  test('should generate migration for many-to-many relation with different update/delete actions', () => {
    // Create a raw schema with different actions on relations
    const rawSchema = `
      // PostgreSQL Schema Definition
      model Product {
        id            UUID            @id @default(gen_random_uuid())
        name          VARCHAR(255)
        price         DECIMAL(10,2)
        stock         INTEGER
        orders        ProductOrder[]
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        orderDate     TIMESTAMP       @default(now())
        products      ProductOrder[]
      }

      model ProductOrder {
        id            SERIAL          @id
        orderId       UUID
        productId     UUID
        quantity      INTEGER
        price         DECIMAL(10,2)
        order         Order           @relation(fields: [orderId], references: [id], onDelete: "CASCADE", onUpdate: "RESTRICT")
        product       Product         @relation(fields: [productId], references: [id], onDelete: "SET NULL", onUpdate: "CASCADE")
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
    
    // Check for actions on Order relation
    const orderFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("orderId")'));
    expect(orderFk).toBeDefined();
    expect(orderFk?.sql).toContain('ON DELETE CASCADE');
    expect(orderFk?.sql).toContain('ON UPDATE RESTRICT');
    
    // Check for actions on Product relation
    const productFk = fkSteps.find(step => 
      step.sql.includes('FOREIGN KEY ("productId")'));
    expect(productFk).toBeDefined();
    expect(productFk?.sql).toContain('ON DELETE SET NULL');
    expect(productFk?.sql).toContain('ON UPDATE CASCADE');
  });
}); 