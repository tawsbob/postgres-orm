import SchemaParser from '../../parser/schemaParser';
import { MigrationGenerator } from '../migrationGenerator';
import { Schema, Model, FieldAttribute, Field, FieldType, Enum } from '../../parser/types';

describe('Index Generation Tests', () => {
  let parser: SchemaParser;
  let generator: MigrationGenerator;

  beforeEach(() => {
    parser = new SchemaParser();
    generator = new MigrationGenerator();
  });

  test('should generate indexes for all models including Order table', () => {
    // Create a basic schema with an Order model that includes indexes
    const schema: Schema = {
      models: [
        {
          name: 'Order',
          fields: [
            { name: 'id', type: 'UUID' as FieldType, attributes: ['id' as FieldAttribute] },
            { name: 'userId', type: 'UUID' as FieldType, attributes: [] },
            { name: 'status', type: 'OrderStatus' as FieldType, attributes: ['default' as FieldAttribute], defaultValue: 'PENDING' },
            { name: 'createdAt', type: 'TIMESTAMP' as FieldType, attributes: ['default' as FieldAttribute], defaultValue: 'now()' }
          ],
          relations: [],
          indexes: [
            { fields: ['userId'] },
            { fields: ['status', 'createdAt'], name: 'custom_order_status_idx' }
          ]
        },
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID' as FieldType, attributes: ['id' as FieldAttribute] },
            { name: 'email', type: 'VARCHAR' as FieldType, attributes: ['unique' as FieldAttribute], length: 255 }
          ],
          relations: [],
          indexes: [
            { fields: ['email'], unique: true }
          ]
        }
      ],
      enums: [
        { name: 'OrderStatus', values: ['PENDING', 'COMPLETED', 'CANCELLED'] }
      ],
      extensions: [],
      roles: []
    };

    // Generate migration
    const migration = generator.generateMigration(schema);

    // Get all index steps
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    
    // Verify User indexes
    const userIndexes = indexSteps.filter(step => step.name.includes('idx_User'));
    expect(userIndexes.length).toBeGreaterThan(0);
    
    // Verify Order indexes - this is what we're testing
    const orderIndexes = indexSteps.filter(step => 
      step.name.includes('idx_Order') || step.name === 'custom_order_status_idx'
    );
    
    // Should have 2 indexes for Order
    expect(orderIndexes.length).toBe(2);
    
    // Verify index SQL contains the correct content
    const userIdxIndex = orderIndexes.find(step => step.name.includes('userId'));
    expect(userIdxIndex).toBeDefined();
    expect(userIdxIndex?.sql).toContain('"Order"');
    expect(userIdxIndex?.sql).toContain('"userId"');
    
    const customIndex = orderIndexes.find(step => step.name === 'custom_order_status_idx');
    expect(customIndex).toBeDefined();
    expect(customIndex?.sql).toContain('"status", "createdAt"');
  });

  test('should generate indexes for Order in full schema', () => {
    // Parse the real schema
    const schema = parser.parseSchema('schema/database.schema');
    
    // Generate migration
    const migration = generator.generateMigration(schema);

    // Get all index steps
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    
    // Verify Order indexes
    // Because the Order model in the schema doesn't have indexes, we'll verify 
    // that if we add indexes to Order in the future, they will be generated
    
    // Make a deep copy of the schema
    const modifiedSchema = JSON.parse(JSON.stringify(schema)) as Schema;
    
    // Find the Order model
    const orderModel = modifiedSchema.models.find(model => model.name === 'Order') as Model;
    
    // Add indexes to the Order model
    orderModel.indexes = [
      { fields: ['userId'] },
      { fields: ['status'], name: 'order_status_idx' }
    ];
    
    // Generate a new migration with the modified schema
    const newMigration = generator.generateMigration(modifiedSchema);
    
    // Get index steps for Order model
    const orderIndexSteps = newMigration.steps
      .filter(step => step.objectType === 'index')
      .filter(step => step.name.includes('Order') || step.name === 'order_status_idx');
    
    // Should have 2 indexes for Order
    expect(orderIndexSteps.length).toBe(2);
    
    // Verify index SQL contains the correct content
    const userIdxIndex = orderIndexSteps.find(step => step.name.includes('userId'));
    expect(userIdxIndex).toBeDefined();
    expect(userIdxIndex?.sql).toContain('"Order"');
    expect(userIdxIndex?.sql).toContain('"userId"');
  });
}); 