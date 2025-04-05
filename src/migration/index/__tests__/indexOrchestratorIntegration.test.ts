import { Schema, Model, Index } from '../../../parser/types';
import { IndexOrchestrator } from '../indexOrchestrator';
import { MigrationStep } from '../../types';
import { SQLGenerator } from '../../sqlGenerator';

describe('IndexOrchestrator Integration Tests', () => {
  let orchestrator: IndexOrchestrator;
  
  beforeEach(() => {
    orchestrator = new IndexOrchestrator();
  });
  
  // Helper function to create a simple model with specified name and indexes
  const createModelWithIndexes = (name: string, indexes: Index[]): Model => {
    return {
      name,
      fields: [
        { name: 'id', type: 'INTEGER', attributes: ['id'] },
        { name: 'name', type: 'VARCHAR', attributes: [], length: 255 },
        { name: 'email', type: 'VARCHAR', attributes: [], length: 255 },
        { name: 'isActive', type: 'BOOLEAN', attributes: ['default'], defaultValue: 'true' },
        { name: 'role', type: 'VARCHAR', attributes: [], length: 50 }
      ],
      relations: [],
      indexes
    };
  };
  
  describe('Integration with SQL Generator', () => {
    test('should generate proper SQL for creating a basic index', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [])];
      const toModels: Model[] = [createModelWithIndexes('User', [{ fields: ['name'] }])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].sql).toMatch(/CREATE\s+INDEX\s+"idx_User_name"/);
      expect(steps[0].sql).toMatch(/ON\s+"public"."User"/);
      expect(steps[0].sql).toMatch(/\("name"\)/);
    });
    
    test('should generate proper SQL for creating a unique index', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [])];
      const toModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['email'], unique: true }
      ])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+"idx_User_email_unique"/);
    });
    
    test('should generate proper SQL for creating an index with WHERE clause', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [])];
      const toModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['name'], where: 'isActive = true' }
      ])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(1);
      expect(steps[0].sql).toMatch(/CREATE\s+INDEX\s+"idx_User_name_filtered"\s+ON\s+"public"."User"\s+\("name"\)\s+WHERE\s+isActive\s+=\s+true/);
    });
    
    test('should generate proper SQL for creating an index with custom type', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [])];
      const toModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['name'], type: 'btree' }
      ])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(1);
      expect(steps[0].sql).toMatch(/CREATE\s+INDEX\s+"idx_User_name_btree"\s+ON\s+"public"."User"\s+USING\s+btree\s+\("name"\)/);
    });
    
    test('should generate proper SQL for dropping an index', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['name'] }
      ])];
      const toModels: Model[] = [createModelWithIndexes('User', [])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].sql).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+"public"."idx_User_name"/);
    });
    
    test('should generate proper SQL for updating an index', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['name'] }
      ])];
      const toModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['name'], unique: true }
      ])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(2);
      
      // First step should drop the old index
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].sql).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+"public"."idx_User_name"/);
      
      // Second step should create the new unique index
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('index');
      expect(steps[1].sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+"idx_User_name_unique"\s+ON\s+"public"."User"/);
    });
    
    test('should generate proper SQL for index with a custom name', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [])];
      const toModels: Model[] = [createModelWithIndexes('User', [
        { name: 'active_users_name_idx', fields: ['name'], where: 'isActive = true' }
      ])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].name).toBe('active_users_name_idx');
      expect(steps[0].sql).toMatch(/CREATE\s+INDEX\s+"active_users_name_idx"\s+ON\s+"public"."User"/);
    });
    
    test('should generate proper SQL for index with multiple fields', () => {
      // Arrange
      const fromModels: Model[] = [createModelWithIndexes('User', [])];
      const toModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['role', 'isActive'] }
      ])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('index');
      
      // Index name is generated using original field order
      expect(steps[0].name).toBe('idx_User_role_isActive');
      
      // Check that the index SQL contains both fields (order doesn't matter for the regex)
      expect(steps[0].sql).toMatch(/CREATE\s+INDEX\s+"idx_User_role_isActive"\s+ON\s+"public"."User"/);
      expect(steps[0].sql).toMatch(/\((?=.*"role")(?=.*"isActive").*\)/);
    });
    
    test('should generate valid rollback SQL for each step', () => {
      // Arrange - we'll add a name index and remove an email index
      const fromModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['email'], unique: true }
      ])];
      const toModels: Model[] = [createModelWithIndexes('User', [
        { fields: ['name'] }
      ])];
      
      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);
      const steps = orchestrator.generateIndexMigrationSteps(diff);
      
      // Assert - the order is predictable: first added, then updated, then removed
      expect(steps).toHaveLength(2);
      
      // First step: Create name index (added)
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].name).toBe('idx_User_name');
      expect(steps[0].sql).toMatch(/CREATE\s+INDEX/);
      expect(steps[0].rollbackSql).toMatch(/DROP\s+INDEX/); // Rollback should drop it
      
      // Second step: Drop email index (removed)
      expect(steps[1].type).toBe('drop');
      expect(steps[1].objectType).toBe('index');
      expect(steps[1].name).toBe('idx_User_email_unique');
      expect(steps[1].sql).toMatch(/DROP\s+INDEX/);
      expect(steps[1].rollbackSql).toMatch(/CREATE\s+UNIQUE\s+INDEX/); // Rollback should create it
    });
  });
}); 