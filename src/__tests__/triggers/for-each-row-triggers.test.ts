import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('FOR EACH ROW Trigger Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration with FOR EACH ROW on INSERT trigger', () => {
    // Create a raw schema with a FOR EACH ROW INSERT trigger
    const rawSchema = `
      model Customer {
        id UUID @id @default(gen_random_uuid())
        name String
        email String
        createdAt TIMESTAMP @default(now())
        
        @@trigger("AFTER INSERT", {
          level: "FOR EACH ROW",
          execute: """
          -- Log new customer creation
          INSERT INTO AuditLog (action, tableName, recordId, notes)
          VALUES ('INSERT', 'Customer', NEW.id, 'New customer created: ' || NEW.name);
          """
        })
      }
      
      model AuditLog {
        id UUID @id @default(gen_random_uuid())
        action String
        tableName String
        recordId UUID
        notes TEXT
        timestamp TIMESTAMP @default(now())
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includeTriggers: true
    });

    // Find the trigger step
    const triggerStep = migration.steps.find(step => 
      step.objectType === 'trigger' && 
      step.name === 'Customer_after_insert_for_each_row_trigger'
    );
    
    // Check that the trigger step exists and has the right properties
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe('create');
    expect(triggerStep?.objectType).toBe('trigger');
    
    // Verify correct level is set
    expect(triggerStep?.sql).toContain('FOR EACH ROW');
    
    // Verify access to NEW record in the trigger function
    expect(triggerStep?.sql).toContain('NEW.id');
    expect(triggerStep?.sql).toContain('NEW.name');
    
    // Verify the function and trigger creation
    expect(triggerStep?.sql).toContain('CREATE OR REPLACE FUNCTION "public"."Customer_after_insert_for_each_row_trigger_fn"()');
    expect(triggerStep?.sql).toContain('RETURNS TRIGGER');
    expect(triggerStep?.sql).toContain('CREATE TRIGGER Customer_after_insert_for_each_row_trigger');
    expect(triggerStep?.sql).toContain('AFTER INSERT');
    expect(triggerStep?.sql).toContain('ON "public"."Customer"');
    expect(triggerStep?.sql).toContain('EXECUTE FUNCTION "public"."Customer_after_insert_for_each_row_trigger_fn"()');
  });

  test('should generate migration with FOR EACH ROW on DELETE trigger', () => {
    // Create a raw schema with a FOR EACH ROW DELETE trigger
    const rawSchema = `
      model Document {
        id UUID @id @default(gen_random_uuid())
        title String
        content TEXT
        isDeleted BOOLEAN @default(false)
        createdAt TIMESTAMP @default(now())
        
        @@trigger("BEFORE DELETE", {
          level: "FOR EACH ROW",
          execute: """
          -- Soft delete instead of hard delete
          INSERT INTO DocumentArchive (documentId, title, content, archivedAt)
          VALUES (OLD.id, OLD.title, OLD.content, now());
          -- Return NULL to cancel actual delete if using BEFORE DELETE
          -- or add a check to return OLD conditionally
          IF OLD.isDeleted = false THEN
            -- Inform user deletion not allowed for undeleted documents
            RAISE EXCEPTION 'Cannot delete document % that is not marked as deleted', OLD.id;
          END IF;
          -- Allow the deletion to proceed
          RETURN OLD;
          """
        })
      }
      
      model DocumentArchive {
        id UUID @id @default(gen_random_uuid())
        documentId UUID
        title String
        content TEXT
        archivedAt TIMESTAMP
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includeTriggers: true
    });

    // Find the trigger step
    const triggerStep = migration.steps.find(step => 
      step.objectType === 'trigger' && 
      step.name === 'Document_before_delete_for_each_row_trigger'
    );
    
    // Check that the trigger step exists and has the right properties
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe('create');
    expect(triggerStep?.objectType).toBe('trigger');
    
    // Verify correct level is set
    expect(triggerStep?.sql).toContain('FOR EACH ROW');
    
    // Verify access to OLD record in the trigger function
    expect(triggerStep?.sql).toContain('OLD.id');
    expect(triggerStep?.sql).toContain('OLD.title');
    expect(triggerStep?.sql).toContain('OLD.content');
    expect(triggerStep?.sql).toContain('OLD.isDeleted');
    
    // Verify conditional RETURN to control deletion
    expect(triggerStep?.sql).toContain('IF OLD.isDeleted = false THEN');
    expect(triggerStep?.sql).toContain('RAISE EXCEPTION');
    expect(triggerStep?.sql).toContain('RETURN OLD');
    
    // Verify the function and trigger creation
    expect(triggerStep?.sql).toContain('CREATE OR REPLACE FUNCTION "public"."Document_before_delete_for_each_row_trigger_fn"()');
    expect(triggerStep?.sql).toContain('RETURNS TRIGGER');
    expect(triggerStep?.sql).toContain('CREATE TRIGGER Document_before_delete_for_each_row_trigger');
    expect(triggerStep?.sql).toContain('BEFORE DELETE');
    expect(triggerStep?.sql).toContain('ON "public"."Document"');
    expect(triggerStep?.sql).toContain('EXECUTE FUNCTION "public"."Document_before_delete_for_each_row_trigger_fn"()');
  });
  
  test('should handle multiple FOR EACH ROW triggers on same table', () => {
    // Create a raw schema with multiple FOR EACH ROW triggers on same table
    const rawSchema = `
      model Invoice {
        id UUID @id @default(gen_random_uuid())
        customerId UUID
        amount DECIMAL(10,2)
        status String @default("DRAFT")
        createdAt TIMESTAMP @default(now())
        
        // First trigger - after status changes to PAID
        @@trigger("AFTER UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          -- Only proceed if status changed to PAID
          IF OLD.status <> 'PAID' AND NEW.status = 'PAID' THEN
            -- Update customer balance
            UPDATE Customer 
            SET totalSpent = totalSpent + NEW.amount
            WHERE id = NEW.customerId;
            
            -- Create receipt
            INSERT INTO Receipt (invoiceId, paidAmount, paidAt)
            VALUES (NEW.id, NEW.amount, now());
          END IF;
          """
        })
        
        // Second trigger - ensure valid status transitions
        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          -- Define valid status transitions
          IF OLD.status = 'DRAFT' AND NEW.status NOT IN ('PENDING', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid status transition from DRAFT to %', NEW.status;
          ELSIF OLD.status = 'PENDING' AND NEW.status NOT IN ('PAID', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid status transition from PENDING to %', NEW.status;
          ELSIF OLD.status = 'PAID' AND NEW.status <> 'PAID' THEN
            RAISE EXCEPTION 'Cannot change status once paid';
          ELSIF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
            RAISE EXCEPTION 'Cannot reactivate cancelled invoice';
          END IF;
          RETURN NEW;
          """
        })
      }
      
      model Customer {
        id UUID @id @default(gen_random_uuid())
        name String
        totalSpent DECIMAL(10,2) @default(0)
      }
      
      model Receipt {
        id UUID @id @default(gen_random_uuid())
        invoiceId UUID
        paidAmount DECIMAL(10,2)
        paidAt TIMESTAMP
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includeTriggers: true
    });

    // Find the trigger steps for the Invoice model
    const triggerSteps = migration.steps.filter(step => 
      step.objectType === 'trigger' && 
      step.name.startsWith('Invoice_')
    );
    
    // Should have two trigger steps
    expect(triggerSteps.length).toBe(2);
    
    // Verify AFTER UPDATE trigger
    const afterUpdateStep = triggerSteps.find(step => step.name === 'Invoice_after_update_for_each_row_trigger');
    expect(afterUpdateStep).toBeDefined();
    expect(afterUpdateStep?.sql).toContain('AFTER UPDATE');
    expect(afterUpdateStep?.sql).toContain('IF OLD.status <> \'PAID\' AND NEW.status = \'PAID\' THEN');
    expect(afterUpdateStep?.sql).toContain('UPDATE Customer');
    expect(afterUpdateStep?.sql).toContain('INSERT INTO Receipt');
    
    // Verify BEFORE UPDATE trigger
    const beforeUpdateStep = triggerSteps.find(step => step.name === 'Invoice_before_update_for_each_row_trigger');
    expect(beforeUpdateStep).toBeDefined();
    expect(beforeUpdateStep?.sql).toContain('BEFORE UPDATE');
    expect(beforeUpdateStep?.sql).toContain('IF OLD.status = \'DRAFT\'');
    expect(beforeUpdateStep?.sql).toContain('ELSIF OLD.status = \'PENDING\'');
    expect(beforeUpdateStep?.sql).toContain('RAISE EXCEPTION');
    expect(beforeUpdateStep?.sql).toContain('RETURN NEW');
  });
}); 