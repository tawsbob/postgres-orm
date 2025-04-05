import { TriggerOrchestrator } from '../triggerOrchestrator';
import { Schema, Model, Trigger } from '../../../parser/types';

describe('TriggerOrchestrator', () => {
  let orchestrator: TriggerOrchestrator;

  beforeEach(() => {
    orchestrator = new TriggerOrchestrator();
  });

  describe('generateTriggerSteps', () => {
    it('should generate create steps for new triggers', () => {
      const fromSchema: Schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: [{
            event: 'BEFORE INSERT',
            level: 'FOR EACH ROW',
            execute: 'update_timestamp()'
          }]
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const steps = orchestrator.generateTriggerSteps(fromSchema, toSchema);
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('trigger');
      expect(steps[0].name).toBe('users_before_insert_for_each_row_trigger');
    });

    it('should generate drop steps for removed triggers', () => {
      const fromSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: [{
            event: 'BEFORE INSERT',
            level: 'FOR EACH ROW',
            execute: 'update_timestamp()'
          }]
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: []
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const steps = orchestrator.generateTriggerSteps(fromSchema, toSchema);
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('trigger');
      expect(steps[0].name).toBe('users_before_insert_for_each_row_trigger');
    });

    it('should generate update steps for modified triggers', () => {
      const fromSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: [{
            event: 'BEFORE INSERT',
            level: 'FOR EACH ROW',
            execute: 'update_timestamp()'
          }]
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: [{
            event: 'BEFORE INSERT',
            level: 'FOR EACH ROW',
            execute: 'new_update_timestamp()'
          }]
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const steps = orchestrator.generateTriggerSteps(fromSchema, toSchema);
      expect(steps).toHaveLength(2);
      expect(steps[0].type).toBe('drop');
      expect(steps[1].type).toBe('create');
      expect(steps[0].name).toBe('users_before_insert_for_each_row_trigger');
      expect(steps[1].name).toBe('users_before_insert_for_each_row_trigger');
    });

    it('should handle multiple triggers per table', () => {
      const fromSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: [{
            event: 'BEFORE INSERT',
            level: 'FOR EACH ROW',
            execute: 'update_timestamp()'
          }]
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: [
            {
              event: 'BEFORE INSERT',
              level: 'FOR EACH ROW',
              execute: 'update_timestamp()'
            },
            {
              event: 'AFTER UPDATE',
              level: 'FOR EACH ROW',
              execute: 'audit_log()'
            }
          ]
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const steps = orchestrator.generateTriggerSteps(fromSchema, toSchema);
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].name).toBe('users_after_update_for_each_row_trigger');
    });

    it('should handle custom schema names', () => {
      const fromSchema: Schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [{
          name: 'users',
          fields: [],
          relations: [],
          triggers: [{
            event: 'BEFORE INSERT',
            level: 'FOR EACH ROW',
            execute: 'update_timestamp()'
          }]
        }],
        enums: [],
        extensions: [],
        roles: []
      };

      const steps = orchestrator.generateTriggerSteps(fromSchema, toSchema, { schemaName: 'custom' });
      expect(steps[0].sql).toContain('ON "custom"."users"');
      expect(steps[0].sql).toContain('CREATE OR REPLACE FUNCTION "custom"."users_before_insert_for_each_row_trigger_fn"()');
      expect(steps[0].rollbackSql).toContain('ON "custom"."users"');
      expect(steps[0].rollbackSql).toContain('DROP FUNCTION IF EXISTS "custom"."users_before_insert_for_each_row_trigger_fn"()');
    });
  });
}); 