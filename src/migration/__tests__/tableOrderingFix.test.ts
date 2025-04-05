import { Schema } from '../../parser/types';
import { MigrationGenerator } from '../migrationGenerator';
import SchemaParserV1 from '../../parser/schemaParser';

describe('Table Dependencies and Ordering Fix', () => {
  let migrationGenerator: MigrationGenerator;
  let parser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    parser = new SchemaParserV1();
  });

  it('should handle circular dependencies gracefully', () => {
    // Create a schema with circular dependencies
    const schemaContent = `
      model User {
        id     UUID     @id @default(gen_random_uuid())
        orders Order[]
      }

      model Order {
        id     UUID     @id @default(gen_random_uuid())
        userId UUID
        user   User     @relation(fields: [userId], references: [id])
      }
    `;

    // Parse the schema
    const schema = parser.parseSchema(undefined, schemaContent);
    
    // Generate migration
    const migration = migrationGenerator.generateMigration(schema);
    
    // Get the table creation steps
    const tableSteps = migration.steps.filter(
      step => step.objectType === 'table'
    );
    
    // Check that both tables are included in the migration
    expect(tableSteps.length).toBe(2);
    expect(tableSteps.map(step => step.name)).toContain('User');
    expect(tableSteps.map(step => step.name)).toContain('Order');
    
    // Check constraints are included after both tables
    const constraintSteps = migration.steps.filter(
      step => step.objectType === 'constraint'
    );
    
    // Should have the foreign key constraint for Order.userId -> User.id
    expect(constraintSteps.length).toBeGreaterThanOrEqual(1);
    
    // Get the table and constraint creation order
    const orderedObjectNames = migration.steps
      .filter(step => step.objectType === 'table' || step.objectType === 'constraint')
      .map(step => step.name);
    
    // User should come before Order in the creation sequence
    const userIndex = orderedObjectNames.indexOf('User');
    const orderIndex = orderedObjectNames.indexOf('Order');
    expect(userIndex).toBeLessThan(orderIndex);
    
    // The constraint should come after both tables
    const constraintIndex = orderedObjectNames.findIndex(
      name => name.includes('Order') && name.includes('fkey')
    );
    expect(constraintIndex).toBeGreaterThan(userIndex);
    expect(constraintIndex).toBeGreaterThan(orderIndex);
  });
  
  it('should correctly sort complex model dependencies from the schema file', () => {
    // Similar schema structure to the one in the file, but simplified
    const schemaContent = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        orders        Order[]
      }

      model Profile {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID            @unique
        user          User            @relation(fields: [userId], references: [id])
      }

      model Order {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        status        VARCHAR(20)     @default("PENDING")
        user          User            @relation(fields: [userId], references: [id])
        products      ProductOrder[]
      }

      model Product {
        id            UUID            @id @default(gen_random_uuid())
        name          VARCHAR(255)
        orders        ProductOrder[]
      }

      model ProductOrder {
        id            SERIAL          @id
        orderId       UUID
        productId     UUID
        quantity      INTEGER
        order         Order           @relation(fields: [orderId], references: [id])
        product       Product         @relation(fields: [productId], references: [id])
      }
    `;

    // Parse the schema
    const schema = parser.parseSchema(undefined, schemaContent);
    
    // Generate migration
    const migration = migrationGenerator.generateMigration(schema);
    
    // Get the table creation steps
    const tableSteps = migration.steps.filter(
      step => step.objectType === 'table'
    );
    
    // Check that all tables are included
    expect(tableSteps.length).toBe(5);
    const tableNames = tableSteps.map(step => step.name);
    expect(tableNames).toContain('User');
    expect(tableNames).toContain('Profile');
    expect(tableNames).toContain('Order');
    expect(tableNames).toContain('Product');
    expect(tableNames).toContain('ProductOrder');
    
    // Check for correct ordering
    const userIndex = tableNames.indexOf('User');
    const orderIndex = tableNames.indexOf('Order');
    const productIndex = tableNames.indexOf('Product');
    const productOrderIndex = tableNames.indexOf('ProductOrder');
    
    // User should come before Order (because Order depends on User)
    expect(userIndex).toBeLessThan(orderIndex);
    
    // ProductOrder depends on both Order and Product so must come after them
    expect(orderIndex).toBeLessThan(productOrderIndex);
    expect(productIndex).toBeLessThan(productOrderIndex);
  });
}); 