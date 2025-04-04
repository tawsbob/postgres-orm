import { TriggerOrchestrator } from '../triggerOrchestrator';
import { Schema, Model, Trigger } from '../../../parser/types';
import SchemaParser from '../../../parser/schemaParser';

describe('TriggerOrchestrator Integration', () => {
  let orchestrator: TriggerOrchestrator;
  let parser: SchemaParser;

  beforeEach(() => {
    orchestrator = new TriggerOrchestrator();
    parser = new SchemaParser();
  });

  it('should handle trigger creation from parsed schema', () => {
    const schemaContent = `
      model User {
        id        Int      @id @default(autoincrement())
        name      String
        email     String   @unique
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt

        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
            update_timestamp()
          """
        })
      }
    `;

    const schema = parser.parseSchema(undefined, schemaContent);
    const emptySchema: Schema = {
      models: [],
      enums: [],
      extensions: [],
      roles: []
    };

    const steps = orchestrator.generateTriggerSteps(emptySchema, schema);
    
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe('create');
    expect(steps[0].objectType).toBe('trigger');
    expect(steps[0].name).toBe('User_before_update_for_each_row_trigger');
    expect(steps[0].sql).toContain('CREATE TRIGGER');
    expect(steps[0].sql).toContain('BEFORE UPDATE');
    expect(steps[0].sql).toContain('FOR EACH ROW');
    expect(steps[0].sql).toContain('EXECUTE FUNCTION update_timestamp()');
  });

  it('should handle trigger updates from parsed schema', () => {
    const fromSchemaContent = `
      model User {
        id        Int      @id @default(autoincrement())
        name      String
        email     String   @unique
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt

        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
            old_update_timestamp()
          """
        })
      }
    `;

    const toSchemaContent = `
      model User {
        id        Int      @id @default(autoincrement())
        name      String
        email     String   @unique
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt

        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
            new_update_timestamp()
          """
        })
      }
    `;

    const fromSchema = parser.parseSchema(undefined, fromSchemaContent);
    const toSchema = parser.parseSchema(undefined, toSchemaContent);

    const steps = orchestrator.generateTriggerSteps(fromSchema, toSchema);
    
    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe('drop');
    expect(steps[0].objectType).toBe('trigger');
    expect(steps[0].name).toBe('User_before_update_for_each_row_trigger');
    expect(steps[0].sql).toContain('DROP TRIGGER');

    expect(steps[1].type).toBe('create');
    expect(steps[1].objectType).toBe('trigger');
    expect(steps[1].name).toBe('User_before_update_for_each_row_trigger');
    expect(steps[1].sql).toContain('CREATE TRIGGER');
    expect(steps[1].sql).toContain('EXECUTE FUNCTION new_update_timestamp()');
  });

  it('should handle multiple triggers per table from parsed schema', () => {
    const fromSchemaContent = `
      model User {
        id        Int      @id @default(autoincrement())
        name      String
        email     String   @unique
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt

        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
            update_timestamp()
          """
        })
      }
    `;

    const toSchemaContent = `
      model User {
        id        Int      @id @default(autoincrement())
        name      String
        email     String   @unique
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt

        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
            update_timestamp()
          """
        })
        @@trigger("AFTER INSERT", {
          level: "FOR EACH ROW",
          execute: """
            audit_log()
          """
        })
      }
    `;

    const fromSchema = parser.parseSchema(undefined, fromSchemaContent);
    const toSchema = parser.parseSchema(undefined, toSchemaContent);

    const steps = orchestrator.generateTriggerSteps(fromSchema, toSchema);
    
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe('create');
    expect(steps[0].objectType).toBe('trigger');
    expect(steps[0].name).toBe('User_after_insert_for_each_row_trigger');
    expect(steps[0].sql).toContain('CREATE TRIGGER');
    expect(steps[0].sql).toContain('AFTER INSERT');
    expect(steps[0].sql).toContain('EXECUTE FUNCTION audit_log()');
  });

  it('should handle custom schema names from parsed schema', () => {
    const schemaContent = `
      model User {
        id        Int      @id @default(autoincrement())
        name      String
        email     String   @unique
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt

        @@trigger("BEFORE UPDATE", {
          level: "FOR EACH ROW",
          execute: """
            update_timestamp()
          """
        })
      }
    `;

    const schema = parser.parseSchema(undefined, schemaContent);
    const emptySchema: Schema = {
      models: [],
      enums: [],
      extensions: [],
      roles: []
    };

    const steps = orchestrator.generateTriggerSteps(emptySchema, schema, { schemaName: 'custom' });
    
    expect(steps[0].sql).toContain('ON "custom"."User"');
    expect(steps[0].rollbackSql).toContain('ON "custom"."User"');
  });
}); 