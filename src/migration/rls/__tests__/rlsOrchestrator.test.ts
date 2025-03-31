import { Model } from '../../../parser/types';
import { RLSOrchestrator } from '../rlsOrchestrator';

describe('RLSOrchestrator', () => {
  let orchestrator: RLSOrchestrator;

  beforeEach(() => {
    orchestrator = new RLSOrchestrator();
  });

  // Helper function to create a test model
  const createTestModel = (name: string): Model => ({
    name,
    fields: [],
    relations: []
  });

  describe('compareRLS', () => {
    it('should detect added RLS settings', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User') // No RLS
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: false
          }
        }
      ];

      // Act
      const result = orchestrator.compareRLS(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].model.name).toBe('User');
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('should detect removed RLS settings', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: false
          }
        }
      ];
      
      const toModels: Model[] = [
        createTestModel('User') // No RLS
      ];

      // Act
      const result = orchestrator.compareRLS(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].model.name).toBe('User');
      expect(result.updated.length).toBe(0);
    });

    it('should detect updated RLS settings', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: false
          }
        }
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: true // Changed force setting
          }
        }
      ];

      // Act
      const result = orchestrator.compareRLS(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].previousSettings.force).toBe(false);
    });

    it('should detect models with RLS that are added to the schema', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User')
      ];
      
      const toModels: Model[] = [
        createTestModel('User'),
        {
          ...createTestModel('Post'),
          rowLevelSecurity: {
            enabled: true,
            force: true
          }
        }
      ];

      // Act
      const result = orchestrator.compareRLS(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].model.name).toBe('Post');
    });

    it('should detect models with RLS that are removed from the schema', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User'),
        {
          ...createTestModel('Post'),
          rowLevelSecurity: {
            enabled: true,
            force: true
          }
        }
      ];
      
      const toModels: Model[] = [
        createTestModel('User')
      ];

      // Act
      const result = orchestrator.compareRLS(fromModels, toModels);

      // Assert
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].model.name).toBe('Post');
    });

    it('should not detect changes when RLS settings remain the same', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: true
          }
        }
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: true
          }
        }
      ];

      // Act
      const result = orchestrator.compareRLS(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });
  });

  describe('generateRLSMigrationSteps', () => {
    it('should generate steps for added RLS settings', () => {
      // Arrange
      const model: Model = {
        ...createTestModel('User'),
        rowLevelSecurity: {
          enabled: true,
          force: true
        }
      };
      
      const diff = {
        added: [{ model }],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generateRLSMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(2); // One for ENABLE, one for FORCE
      
      // Check first step (ENABLE)
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('rls');
      expect(steps[0].name).toContain('rls_User');
      expect(steps[0].sql).toContain('ENABLE ROW LEVEL SECURITY');
      expect(steps[0].rollbackSql).toContain('DISABLE ROW LEVEL SECURITY');
      
      // Check second step (FORCE)
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('rls');
      expect(steps[1].name).toContain('rls_User');
      expect(steps[1].sql).toContain('FORCE ROW LEVEL SECURITY');
      expect(steps[1].rollbackSql).toContain('DISABLE ROW LEVEL SECURITY');
    });

    it('should generate steps for removed RLS settings', () => {
      // Arrange
      const model: Model = {
        ...createTestModel('User'),
        rowLevelSecurity: {
          enabled: true,
          force: true
        }
      };
      
      const diff = {
        added: [],
        removed: [{ model }],
        updated: []
      };

      // Act
      const steps = orchestrator.generateRLSMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(2); // One for DISABLE, one for NO FORCE
      
      // Check first step (DISABLE)
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('rls');
      expect(steps[0].name).toBe('rls_User_disable');
      expect(steps[0].sql).toContain('DISABLE ROW LEVEL SECURITY');
      expect(steps[0].rollbackSql).toContain('ENABLE ROW LEVEL SECURITY');
      
      // Check second step (NO FORCE)
      expect(steps[1].type).toBe('drop');
      expect(steps[1].objectType).toBe('rls');
      expect(steps[1].name).toBe('rls_User_no_force');
      expect(steps[1].sql).toContain('NO FORCE ROW LEVEL SECURITY');
      expect(steps[1].rollbackSql).toContain('FORCE ROW LEVEL SECURITY');
    });

    it('should generate steps for updated RLS settings (enabled to disabled)', () => {
      // Arrange
      const model: Model = {
        ...createTestModel('User'),
        rowLevelSecurity: {
          enabled: false,
          force: true
        }
      };
      
      const diff = {
        added: [],
        removed: [],
        updated: [{
          model,
          previousSettings: {
            enabled: true,
            force: true
          }
        }]
      };

      // Act
      const steps = orchestrator.generateRLSMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('alter');
      expect(steps[0].objectType).toBe('rls');
      expect(steps[0].name).toBe('rls_User_disable');
      expect(steps[0].sql).toContain('DISABLE ROW LEVEL SECURITY');
      expect(steps[0].rollbackSql).toContain('ENABLE ROW LEVEL SECURITY');
    });

    it('should generate steps for updated RLS settings (force to no force)', () => {
      // Arrange
      const model: Model = {
        ...createTestModel('User'),
        rowLevelSecurity: {
          enabled: true,
          force: false
        }
      };
      
      const diff = {
        added: [],
        removed: [],
        updated: [{
          model,
          previousSettings: {
            enabled: true,
            force: true
          }
        }]
      };

      // Act
      const steps = orchestrator.generateRLSMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('alter');
      expect(steps[0].objectType).toBe('rls');
      expect(steps[0].name).toBe('rls_User_no_force');
      expect(steps[0].sql).toContain('NO FORCE ROW LEVEL SECURITY');
      expect(steps[0].rollbackSql).toContain('FORCE ROW LEVEL SECURITY');
    });

    it('should generate steps for updated RLS settings (both enabled and force changed)', () => {
      // Arrange
      const model: Model = {
        ...createTestModel('User'),
        rowLevelSecurity: {
          enabled: false,
          force: false
        }
      };
      
      const diff = {
        added: [],
        removed: [],
        updated: [{
          model,
          previousSettings: {
            enabled: true,
            force: true
          }
        }]
      };

      // Act
      const steps = orchestrator.generateRLSMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(2);
      
      // Check first step (DISABLE)
      expect(steps[0].type).toBe('alter');
      expect(steps[0].objectType).toBe('rls');
      expect(steps[0].name).toBe('rls_User_disable');
      expect(steps[0].sql).toContain('DISABLE ROW LEVEL SECURITY');
      
      // Check second step (NO FORCE)
      expect(steps[1].type).toBe('alter');
      expect(steps[1].objectType).toBe('rls');
      expect(steps[1].name).toBe('rls_User_no_force');
      expect(steps[1].sql).toContain('NO FORCE ROW LEVEL SECURITY');
    });
  });
}); 