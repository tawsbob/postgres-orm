import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Trigger PL/pgSQL Code Execution Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration with complex PL/pgSQL trigger code', () => {
    // Create a raw schema with complex PL/pgSQL trigger code
    const rawSchema = `
      model Order {
        id UUID @id @default(gen_random_uuid())
        status String
        totalAmount DECIMAL(10,2)
        createdAt TIMESTAMP @default(now())
        
        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          -- Calculate tax and update total
          DECLARE
            tax_rate DECIMAL(5,2) := 0.08;
            base_amount DECIMAL(10,2);
            tax_amount DECIMAL(10,2);
          BEGIN
            IF OLD.status <> NEW.status AND NEW.status = 'COMPLETED' THEN
              -- Calculate base amount (excluding tax)
              base_amount := NEW.totalAmount / (1 + tax_rate);
              
              -- Calculate tax amount
              tax_amount := base_amount * tax_rate;
              
              -- Round to 2 decimal places
              tax_amount := ROUND(tax_amount, 2);
              
              -- Insert into audit log
              INSERT INTO OrderAudit (orderId, oldStatus, newStatus, taxAmount)
              VALUES (NEW.id, OLD.status, NEW.status, tax_amount);

              RETURN NEW;
            END IF;
            RETURN NEW;
          END;
          """
        })
      }
      
      model OrderAudit {
        id UUID @id @default(gen_random_uuid())
        orderId UUID
        oldStatus String
        newStatus String
        taxAmount DECIMAL(10,2)
        auditDate TIMESTAMP @default(now())
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
      step.name === 'Order_before_update_for_each_row_trigger'
    );
    
    // Check that the trigger step exists and has the right properties
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe('create');
    expect(triggerStep?.objectType).toBe('trigger');
    
    // Verify the SQL contains all the PL/pgSQL elements
    expect(triggerStep?.sql).toContain('CREATE OR REPLACE FUNCTION "public"."Order_before_update_for_each_row_trigger_fn"()');
    expect(triggerStep?.sql).toContain('RETURNS TRIGGER');
    expect(triggerStep?.sql).toContain('-- Calculate tax and update total');
    expect(triggerStep?.sql).toContain('DECLARE');
    expect(triggerStep?.sql).toContain('tax_rate DECIMAL(5,2) := 0.08');
    expect(triggerStep?.sql).toContain('base_amount DECIMAL(10,2)');
    expect(triggerStep?.sql).toContain('BEGIN');
    expect(triggerStep?.sql).toContain('IF OLD.status <> NEW.status AND NEW.status = \'COMPLETED\' THEN');
    expect(triggerStep?.sql).toContain('base_amount := NEW.totalAmount / (1 + tax_rate)');
    expect(triggerStep?.sql).toContain('tax_amount := base_amount * tax_rate');
    expect(triggerStep?.sql).toContain('tax_amount := ROUND(tax_amount, 2)');
    expect(triggerStep?.sql).toContain('INSERT INTO OrderAudit');
    expect(triggerStep?.sql).toContain('VALUES (NEW.id, OLD.status, NEW.status, tax_amount)');
    expect(triggerStep?.sql).toContain('RETURN NEW');
    expect(triggerStep?.sql).toContain('END IF');
    expect(triggerStep?.sql).toContain('END');
    expect(triggerStep?.sql).toContain('LANGUAGE plpgsql');
    
    // Verify trigger creation part
    expect(triggerStep?.sql).toContain('CREATE TRIGGER Order_before_update_for_each_row_trigger');
    expect(triggerStep?.sql).toContain('BEFORE UPDATE');
    expect(triggerStep?.sql).toContain('FOR EACH ROW');
    expect(triggerStep?.sql).toContain('ON "public"."Order"');
    expect(triggerStep?.sql).toContain('EXECUTE FUNCTION "public"."Order_before_update_for_each_row_trigger_fn"()');
  });

  test('should generate migration with conditional branching in PL/pgSQL', () => {
    // Create a raw schema with conditional logic in PL/pgSQL
    const rawSchema = `
      model User {
        id UUID @id @default(gen_random_uuid())
        name String
        email String
        role String
        status String
        lastLogin TIMESTAMP
        
        @@trigger("AFTER UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          BEGIN
            -- Different logic based on what changed
            IF OLD.role <> NEW.role THEN
              -- Log role change
              INSERT INTO UserLog (userId, action, details)
              VALUES (NEW.id, 'ROLE_CHANGE', 'Changed from ' || OLD.role || ' to ' || NEW.role);
              
            ELSIF OLD.status <> NEW.status THEN
              -- Log status change
              INSERT INTO UserLog (userId, action, details)
              VALUES (NEW.id, 'STATUS_CHANGE', 'Changed from ' || OLD.status || ' to ' || NEW.status);
              
              -- Additional actions for specific status changes
              IF NEW.status = 'SUSPENDED' THEN
                -- Send notification
                PERFORM pg_notify('user_suspended', NEW.id::text);
              ELSIF NEW.status = 'ACTIVE' AND OLD.status = 'SUSPENDED' THEN
                -- Reactivate user tracking
                UPDATE UserTracking SET isActive = TRUE WHERE userId = NEW.id;
              END IF;
              
            ELSIF NEW.lastLogin IS NOT NULL AND (OLD.lastLogin IS NULL OR NEW.lastLogin <> OLD.lastLogin) THEN
              -- Update login count
              UPDATE UserStats SET loginCount = loginCount + 1 WHERE userId = NEW.id;
              IF NOT FOUND THEN
                INSERT INTO UserStats (userId, loginCount) VALUES (NEW.id, 1);
              END IF;
            END IF;
            
            RETURN NEW;
          END;
          """
        })
      }
      
      model UserLog {
        id UUID @id @default(gen_random_uuid())
        userId UUID
        action String
        details TEXT
        timestamp TIMESTAMP @default(now())
      }
      
      model UserStats {
        userId UUID @id
        loginCount INTEGER @default(0)
        lastActivityAt TIMESTAMP @default(now())
      }
      
      model UserTracking {
        id UUID @id @default(gen_random_uuid())
        userId UUID
        isActive BOOLEAN @default(true)
        trackingSince TIMESTAMP @default(now())
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
      step.name === 'User_after_update_for_each_row_trigger'
    );
    
    // Check that the trigger step exists and has the right properties
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe('create');
    expect(triggerStep?.objectType).toBe('trigger');
    
    // Verify the SQL contains the complex conditional logic
    expect(triggerStep?.sql).toContain('IF OLD.role <> NEW.role THEN');
    expect(triggerStep?.sql).toContain('ELSIF OLD.status <> NEW.status THEN');
    expect(triggerStep?.sql).toContain('IF NEW.status = \'SUSPENDED\' THEN');
    expect(triggerStep?.sql).toContain('ELSIF NEW.status = \'ACTIVE\' AND OLD.status = \'SUSPENDED\' THEN');
    expect(triggerStep?.sql).toContain('ELSIF NEW.lastLogin IS NOT NULL AND (OLD.lastLogin IS NULL OR NEW.lastLogin <> OLD.lastLogin) THEN');
    
    // Verify it contains the database operations
    expect(triggerStep?.sql).toContain('INSERT INTO UserLog');
    expect(triggerStep?.sql).toContain('PERFORM pg_notify');
    expect(triggerStep?.sql).toContain('UPDATE UserTracking');
    expect(triggerStep?.sql).toContain('UPDATE UserStats');
    expect(triggerStep?.sql).toContain('IF NOT FOUND THEN');
    expect(triggerStep?.sql).toContain('INSERT INTO UserStats');
  });
}); 