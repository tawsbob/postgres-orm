import { Schema } from '../../parser/types';
import { MigrationGenerator } from '../migrationGenerator';

describe('Enum Migration Integration', () => {
  let migrationGenerator: MigrationGenerator;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
  });

  describe('generateMigrationFromDiff with enums', () => {
    it('should generate migration steps for added enums', () => {
      const fromSchema: Schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER', 'GUEST'] }
        ],
        extensions: [],
        roles: []
      };

      const migration = migrationGenerator.generateMigrationFromDiff(
        fromSchema, 
        toSchema, 
        { includeEnums: true, includeExtensions: false, includeTables: false, includeRoles: false }
      );

      expect(migration.steps).toHaveLength(1);
      expect(migration.steps[0].type).toBe('create');
      expect(migration.steps[0].objectType).toBe('enum');
      expect(migration.steps[0].name).toBe('UserRole');
      expect(migration.steps[0].sql).toContain('UserRole');
      expect(migration.steps[0].sql).toContain('ADMIN');
      expect(migration.steps[0].sql).toContain('USER');
      expect(migration.steps[0].sql).toContain('GUEST');
    });

    it('should generate migration steps for removed enums', () => {
      const fromSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER', 'GUEST'] }
        ],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: []
      };

      const migration = migrationGenerator.generateMigrationFromDiff(
        fromSchema, 
        toSchema, 
        { includeEnums: true, includeExtensions: false, includeTables: false, includeRoles: false }
      );

      expect(migration.steps).toHaveLength(1);
      expect(migration.steps[0].type).toBe('drop');
      expect(migration.steps[0].objectType).toBe('enum');
      expect(migration.steps[0].name).toBe('UserRole');
      expect(migration.steps[0].sql).toContain('DROP TYPE');
      expect(migration.steps[0].sql).toContain('UserRole');
    });

    it('should generate migration steps for updated enums', () => {
      const fromSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER'] }
        ],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER', 'GUEST'] }
        ],
        extensions: [],
        roles: []
      };

      const migration = migrationGenerator.generateMigrationFromDiff(
        fromSchema, 
        toSchema, 
        { includeEnums: true, includeExtensions: false, includeTables: false, includeRoles: false }
      );

      expect(migration.steps).toHaveLength(2);
      
      // First step should drop the enum
      expect(migration.steps[0].type).toBe('drop');
      expect(migration.steps[0].objectType).toBe('enum');
      expect(migration.steps[0].name).toBe('UserRole_drop');
      expect(migration.steps[0].sql).toContain('DROP TYPE');
      
      // Second step should recreate the enum with new values
      expect(migration.steps[1].type).toBe('create');
      expect(migration.steps[1].objectType).toBe('enum');
      expect(migration.steps[1].name).toBe('UserRole');
      expect(migration.steps[1].sql).toContain('CREATE TYPE');
      expect(migration.steps[1].sql).toContain('ADMIN');
      expect(migration.steps[1].sql).toContain('USER');
      expect(migration.steps[1].sql).toContain('GUEST');
    });

    it('should not generate migration steps for unchanged enums', () => {
      const fromSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER', 'GUEST'] }
        ],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER', 'GUEST'] }
        ],
        extensions: [],
        roles: []
      };

      const migration = migrationGenerator.generateMigrationFromDiff(
        fromSchema, 
        toSchema, 
        { includeEnums: true, includeExtensions: false, includeTables: false, includeRoles: false }
      );

      expect(migration.steps).toHaveLength(0);
    });

    it('should handle multiple enum changes in the same migration', () => {
      const fromSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER'] },
          { name: 'OrderStatus', values: ['PENDING', 'SHIPPED', 'DELIVERED'] }
        ],
        extensions: [],
        roles: []
      };

      const toSchema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER', 'GUEST'] },
          { name: 'PaymentStatus', values: ['PAID', 'PENDING', 'FAILED'] }
        ],
        extensions: [],
        roles: []
      };

      const migration = migrationGenerator.generateMigrationFromDiff(
        fromSchema, 
        toSchema, 
        { includeEnums: true, includeExtensions: false, includeTables: false, includeRoles: false }
      );

      // Should have 4 steps:
      // 1. Drop UserRole enum
      // 2. Recreate UserRole enum with new values
      // 3. Drop OrderStatus enum
      // 4. Create PaymentStatus enum
      expect(migration.steps).toHaveLength(4);
      
      // Check for all enum operations
      const enumOperations = migration.steps.map(step => ({
        type: step.type,
        name: step.name
      }));
      
      expect(enumOperations).toContainEqual({ type: 'drop', name: 'UserRole_drop' });
      expect(enumOperations).toContainEqual({ type: 'create', name: 'UserRole' });
      expect(enumOperations).toContainEqual({ type: 'drop', name: 'OrderStatus' });
      expect(enumOperations).toContainEqual({ type: 'create', name: 'PaymentStatus' });
    });
  });

  describe('generateMigration with enums', () => {
    it('should generate migration steps for all enums in the schema', () => {
      const schema: Schema = {
        models: [],
        enums: [
          { name: 'UserRole', values: ['ADMIN', 'USER', 'GUEST'] },
          { name: 'OrderStatus', values: ['PENDING', 'SHIPPED', 'DELIVERED'] }
        ],
        extensions: [],
        roles: []
      };

      const migration = migrationGenerator.generateMigration(
        schema, 
        { includeEnums: true, includeExtensions: false, includeTables: false, includeRoles: false }
      );

      expect(migration.steps).toHaveLength(2);
      
      // Check that both enums are created
      expect(migration.steps[0].type).toBe('create');
      expect(migration.steps[0].objectType).toBe('enum');
      expect(migration.steps[1].type).toBe('create');
      expect(migration.steps[1].objectType).toBe('enum');
      
      // Check that we have one step for each enum
      const enumNames = migration.steps.map(step => step.name);
      expect(enumNames).toContain('UserRole');
      expect(enumNames).toContain('OrderStatus');
    });
  });
}); 