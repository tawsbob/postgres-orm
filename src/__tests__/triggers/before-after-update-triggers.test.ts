import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Trigger BEFORE/AFTER UPDATE Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for BEFORE UPDATE trigger', () => {
    // Create a raw schema with a BEFORE UPDATE trigger
    const rawSchema = `
      model User {
        id UUID @id @default(gen_random_uuid())
        email String
        balance INTEGER
        
        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          IF (OLD.balance <> NEW.balance) THEN
            RAISE EXCEPTION 'Balance cannot be updated directly';
          END IF;
          """
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
      includeRoles: false,
      includeTriggers: true
    });

    // Find the trigger step
    const triggerStep = migration.steps.find(step => 
      step.objectType === 'trigger' && 
      step.name === 'User_before_update_for_each_row_trigger'
    );
    
    // Check that the trigger step exists and has the right properties
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe('create');
    expect(triggerStep?.objectType).toBe('trigger');
    
    // Verify the SQL
    expect(triggerStep?.sql).toContain('CREATE OR REPLACE FUNCTION "public"."User_before_update_for_each_row_trigger_fn"()');
    expect(triggerStep?.sql).toContain('RETURNS TRIGGER');
    expect(triggerStep?.sql).toContain('IF (OLD.balance <> NEW.balance) THEN');
    expect(triggerStep?.sql).toContain('RAISE EXCEPTION \'Balance cannot be updated directly\'');
    expect(triggerStep?.sql).toContain('RETURN NEW');
    expect(triggerStep?.sql).toContain('LANGUAGE plpgsql');
    expect(triggerStep?.sql).toContain('CREATE TRIGGER User_before_update_for_each_row_trigger');
    expect(triggerStep?.sql).toContain('BEFORE UPDATE');
    expect(triggerStep?.sql).toContain('FOR EACH ROW');
    expect(triggerStep?.sql).toContain('ON "public"."User"');
    expect(triggerStep?.sql).toContain('EXECUTE FUNCTION "public"."User_before_update_for_each_row_trigger_fn"()');
    
    // Verify rollback SQL
    expect(triggerStep?.rollbackSql).toContain('DROP TRIGGER IF EXISTS User_before_update_for_each_row_trigger ON "public"."User"');
    expect(triggerStep?.rollbackSql).toContain('DROP FUNCTION IF EXISTS "public"."User_before_update_for_each_row_trigger_fn"()');
  });
  
  test('should generate migration for AFTER UPDATE trigger', () => {
    // Create a raw schema with an AFTER UPDATE trigger
    const rawSchema = `
      model Product {
        id UUID @id @default(gen_random_uuid())
        name String
        stock INTEGER
        
        @@trigger("AFTER UPDATE", {
          level: "FOR EACH ROW",
          execute: """
          IF (OLD.stock <> NEW.stock) THEN
            INSERT INTO Log (message)
            VALUES ('Product stock updated from ' || OLD.stock || ' to ' || NEW.stock);
          END IF;
          """
        })
      }
      
      model Log {
        id UUID @id @default(gen_random_uuid())
        message TEXT
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
      includeRoles: false,
      includeTriggers: true
    });

    // Find the trigger step
    const triggerStep = migration.steps.find(step => 
      step.objectType === 'trigger' && 
      step.name === 'Product_after_update_for_each_row_trigger'
    );
    
    // Check that the trigger step exists and has the right properties
    expect(triggerStep).toBeDefined();
    expect(triggerStep?.type).toBe('create');
    expect(triggerStep?.objectType).toBe('trigger');
    
    // Verify the SQL
    expect(triggerStep?.sql).toContain('CREATE OR REPLACE FUNCTION "public"."Product_after_update_for_each_row_trigger_fn"()');
    expect(triggerStep?.sql).toContain('RETURNS TRIGGER');
    expect(triggerStep?.sql).toContain('IF (OLD.stock <> NEW.stock) THEN');
    expect(triggerStep?.sql).toContain('INSERT INTO Log (message)');
    expect(triggerStep?.sql).toContain('VALUES (\'Product stock updated from \' || OLD.stock || \' to \' || NEW.stock)');
    expect(triggerStep?.sql).toContain('RETURN NEW');
    expect(triggerStep?.sql).toContain('LANGUAGE plpgsql');
    expect(triggerStep?.sql).toContain('CREATE TRIGGER Product_after_update_for_each_row_trigger');
    expect(triggerStep?.sql).toContain('AFTER UPDATE');
    expect(triggerStep?.sql).toContain('FOR EACH ROW');
    expect(triggerStep?.sql).toContain('ON "public"."Product"');
    expect(triggerStep?.sql).toContain('EXECUTE FUNCTION "public"."Product_after_update_for_each_row_trigger_fn"()');
    
    // Verify rollback SQL
    expect(triggerStep?.rollbackSql).toContain('DROP TRIGGER IF EXISTS Product_after_update_for_each_row_trigger ON "public"."Product"');
    expect(triggerStep?.rollbackSql).toContain('DROP FUNCTION IF EXISTS "public"."Product_after_update_for_each_row_trigger_fn"()');
  });
}); 