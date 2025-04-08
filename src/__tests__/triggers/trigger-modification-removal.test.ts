import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Trigger Modification and Removal Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for modifying a trigger', () => {
    // Define the original schema with a trigger
    const originalSchema = `
      model Product {
        id UUID @id @default(gen_random_uuid())
        name String
        price DECIMAL(10,2)
        stock INTEGER
        
        @@trigger("AFTER UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          -- Original trigger code
          IF OLD.stock <> NEW.stock THEN
            INSERT INTO InventoryLog (productId, oldStock, newStock, updatedAt)
            VALUES (NEW.id, OLD.stock, NEW.stock, now());
          END IF;
          """
        })
      }
      
      model InventoryLog {
        id UUID @id @default(gen_random_uuid())
        productId UUID
        oldStock INTEGER
        newStock INTEGER
        updatedAt TIMESTAMP
      }
    `;

    // Define the updated schema with modified trigger code
    const updatedSchema = `
      model Product {
        id UUID @id @default(gen_random_uuid())
        name String
        price DECIMAL(10,2)
        stock INTEGER
        
        @@trigger("AFTER UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          -- Modified trigger code with additional functionality
          IF OLD.stock <> NEW.stock THEN
            -- Log the inventory change
            INSERT INTO InventoryLog (productId, oldStock, newStock, updatedAt)
            VALUES (NEW.id, OLD.stock, NEW.stock, now());
            
            -- Check if stock is low
            IF NEW.stock < 10 THEN
              -- Send notification for low stock
              INSERT INTO Notification (productId, message, isRead)
              VALUES (NEW.id, 'Low stock alert for product: ' || NEW.name, false);
            END IF;
          END IF;
          """
        })
      }
      
      model InventoryLog {
        id UUID @id @default(gen_random_uuid())
        productId UUID
        oldStock INTEGER
        newStock INTEGER
        updatedAt TIMESTAMP
      }
      
      model Notification {
        id UUID @id @default(gen_random_uuid())
        productId UUID
        message TEXT
        isRead BOOLEAN
        createdAt TIMESTAMP @default(now())
      }
    `;

    // Parse both schemas
    const fromSchema = schemaParser.parseSchema(undefined, originalSchema);
    const toSchema = schemaParser.parseSchema(undefined, updatedSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includeTriggers: true
    });

    // Find the drop and create steps for the trigger
    const triggerSteps = migration.steps.filter(step => 
      step.objectType === 'trigger' && 
      step.name === 'Product_after_update_for_each_row_trigger'
    );
    
    // Should have two steps - one to drop and one to recreate
    expect(triggerSteps.length).toBe(2);
    
    // First step should be drop
    expect(triggerSteps[0].type).toBe('drop');
    expect(triggerSteps[0].sql).toContain('DROP TRIGGER IF EXISTS');
    expect(triggerSteps[0].sql).toContain('Product_after_update_for_each_row_trigger');
    
    // Second step should be create with new code
    expect(triggerSteps[1].type).toBe('create');
    expect(triggerSteps[1].sql).toContain('CREATE OR REPLACE FUNCTION');
    expect(triggerSteps[1].sql).toContain('-- Modified trigger code with additional functionality');
    expect(triggerSteps[1].sql).toContain('IF NEW.stock < 10 THEN');
    expect(triggerSteps[1].sql).toContain('INSERT INTO Notification');
  });

  test('should generate migration for removing a trigger', () => {
    // Define the original schema with a trigger
    const originalSchema = `
      model User {
        id UUID @id @default(gen_random_uuid())
        email String
        lastLogin TIMESTAMP
        
        @@trigger("AFTER UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          IF NEW.lastLogin <> OLD.lastLogin THEN
            INSERT INTO LoginHistory (userId, loginTime)
            VALUES (NEW.id, NEW.lastLogin);
          END IF;
          """
        })
      }
      
      model LoginHistory {
        id UUID @id @default(gen_random_uuid())
        userId UUID
        loginTime TIMESTAMP
      }
    `;

    // Define the updated schema without the trigger
    const updatedSchema = `
      model User {
        id UUID @id @default(gen_random_uuid())
        email String
        lastLogin TIMESTAMP
      }
      
      model LoginHistory {
        id UUID @id @default(gen_random_uuid())
        userId UUID
        loginTime TIMESTAMP
      }
    `;

    // Parse both schemas
    const fromSchema = schemaParser.parseSchema(undefined, originalSchema);
    const toSchema = schemaParser.parseSchema(undefined, updatedSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includeTriggers: true
    });

    // Find the drop step for the trigger
    const triggerStep = migration.steps.find(step => 
      step.objectType === 'trigger' && 
      step.type === 'drop' &&
      step.name === 'User_after_update_for_each_row_trigger'
    );
    
    // Check that the step exists and has the right properties
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe('drop');
    expect(triggerStep?.objectType).toBe('trigger');
    
    // Verify SQL for dropping trigger and function
    expect(triggerStep?.sql).toContain('DROP TRIGGER IF EXISTS User_after_update_for_each_row_trigger');
    expect(triggerStep?.sql).toContain('DROP FUNCTION IF EXISTS "public"."User_after_update_for_each_row_trigger_fn"()');
  });

  test('should generate migration for changing trigger event or level', () => {
    // Define the original schema with a BEFORE UPDATE trigger
    const originalSchema = `
      model Post {
        id UUID @id @default(gen_random_uuid())
        title String
        content TEXT
        publishedAt TIMESTAMP
        
        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          -- Set updated timestamp
          NEW.publishedAt = now();
          RETURN NEW;
          """
        })
      }
    `;

    // Define the updated schema with an AFTER UPDATE trigger
    const updatedSchema = `
      model Post {
        id UUID @id @default(gen_random_uuid())
        title String
        content TEXT
        publishedAt TIMESTAMP
        
        @@trigger("AFTER UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          -- Log the update after it happens
          INSERT INTO PostHistory (postId, updatedAt)
          VALUES (NEW.id, now());
          """
        })
      }
      
      model PostHistory {
        id UUID @id @default(gen_random_uuid())
        postId UUID
        updatedAt TIMESTAMP
      }
    `;

    // Parse both schemas
    const fromSchema = schemaParser.parseSchema(undefined, originalSchema);
    const toSchema = schemaParser.parseSchema(undefined, updatedSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includeTriggers: true
    });
    
    // We should have at least two trigger-related steps:
    // 1. Drop the old BEFORE UPDATE trigger
    // 2. Create the new AFTER UPDATE trigger
    
    // Find the steps
    const dropStep = migration.steps.find(step => 
      step.objectType === 'trigger' && 
      step.type === 'drop' &&
      step.name === 'Post_before_update_for_each_row_trigger'
    );
    
    const createStep = migration.steps.find(step => 
      step.objectType === 'trigger' && 
      step.type === 'create' &&
      step.name === 'Post_after_update_for_each_row_trigger'
    );
    
    // Verify both steps exist
    expect(dropStep).toBeDefined();
    expect(createStep).toBeDefined();
    
    // Verify drop step
    expect(dropStep?.sql).toContain('DROP TRIGGER IF EXISTS Post_before_update_for_each_row_trigger');
    
    // Verify create step
    expect(createStep?.sql).toContain('CREATE TRIGGER Post_after_update_for_each_row_trigger');
    expect(createStep?.sql).toContain('AFTER UPDATE');
    expect(createStep?.sql).toContain('INSERT INTO PostHistory');
  });
}); 