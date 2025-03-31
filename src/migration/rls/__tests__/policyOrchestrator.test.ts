import { Model, Policy } from '../../../parser/types';
import { PolicyOrchestrator } from '../policyOrchestrator';

describe('PolicyOrchestrator', () => {
  let orchestrator: PolicyOrchestrator;

  beforeEach(() => {
    orchestrator = new PolicyOrchestrator();
  });

  // Helper function to create a test model
  const createTestModel = (name: string): Model => ({
    name,
    fields: [],
    relations: []
  });

  // Helper function to create a test policy
  const createTestPolicy = (name: string, to: string = 'public'): Policy => ({
    name,
    for: ['select', 'insert', 'update', 'delete'],
    to,
    using: '(user_id = current_user_id())'
  });

  describe('comparePolicies', () => {
    it('should detect added policies', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User') // No policies
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [createTestPolicy('user_policy')]
        }
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].model.name).toBe('User');
      expect(result.added[0].policy.name).toBe('user_policy');
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('should detect removed policies', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [createTestPolicy('user_policy')]
        }
      ];
      
      const toModels: Model[] = [
        createTestModel('User') // No policies
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].model.name).toBe('User');
      expect(result.removed[0].policy.name).toBe('user_policy');
      expect(result.updated.length).toBe(0);
    });

    it('should detect updated policies with changed "to" role', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [createTestPolicy('user_policy', 'public')]
        }
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [createTestPolicy('user_policy', 'authenticated')] // Changed role
        }
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].policy.name).toBe('user_policy');
      expect(result.updated[0].policy.to).toBe('authenticated');
      expect(result.updated[0].previousPolicy.to).toBe('public');
    });

    it('should detect updated policies with changed "using" condition', () => {
      // Arrange
      const fromPolicy = createTestPolicy('user_policy');
      const toPolicy = { ...createTestPolicy('user_policy'), using: '(user_id = auth.uid())' }; // Changed using condition
      
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [fromPolicy]
        }
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [toPolicy]
        }
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].policy.name).toBe('user_policy');
      expect(result.updated[0].policy.using).toBe('(user_id = auth.uid())');
      expect(result.updated[0].previousPolicy.using).toBe('(user_id = current_user_id())');
    });

    it('should detect updated policies with changed "for" actions', () => {
      // Arrange
      const fromPolicy = createTestPolicy('user_policy');
      const toPolicy = { ...createTestPolicy('user_policy'), for: ['select', 'update'] }; // Changed for actions
      
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [fromPolicy]
        }
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [toPolicy]
        }
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].policy.name).toBe('user_policy');
      expect(result.updated[0].policy.for).toEqual(['select', 'update']);
      expect(result.updated[0].previousPolicy.for).toEqual(['select', 'insert', 'update', 'delete']);
    });

    it('should detect models with policies that are added to the schema', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User')
      ];
      
      const toModels: Model[] = [
        createTestModel('User'),
        {
          ...createTestModel('Post'),
          policies: [createTestPolicy('post_policy')]
        }
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].model.name).toBe('Post');
      expect(result.added[0].policy.name).toBe('post_policy');
    });

    it('should detect models with policies that are removed from the schema', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User'),
        {
          ...createTestModel('Post'),
          policies: [createTestPolicy('post_policy')]
        }
      ];
      
      const toModels: Model[] = [
        createTestModel('User')
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].model.name).toBe('Post');
      expect(result.removed[0].policy.name).toBe('post_policy');
    });

    it('should not detect changes when policy settings remain the same', () => {
      // Arrange
      const policy = createTestPolicy('user_policy');
      
      const fromModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [policy]
        }
      ];
      
      const toModels: Model[] = [
        {
          ...createTestModel('User'),
          policies: [policy]
        }
      ];

      // Act
      const result = orchestrator.comparePolicies(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });
  });

  describe('generatePolicyMigrationSteps', () => {
    it('should generate steps for added policies', () => {
      // Arrange
      const model: Model = {
        ...createTestModel('User'),
        policies: [createTestPolicy('user_policy')]
      };
      
      const diff = {
        added: [{ model, policy: model.policies![0] }],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generatePolicyMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('policy');
      expect(steps[0].name).toBe('policy_User_user_policy');
      expect(steps[0].sql).toContain('CREATE POLICY');
      expect(steps[0].rollbackSql).toContain('DROP POLICY');
    });

    it('should generate steps for removed policies', () => {
      // Arrange
      const model: Model = {
        ...createTestModel('User'),
        policies: [createTestPolicy('user_policy')]
      };
      
      const diff = {
        added: [],
        removed: [{ model, policy: model.policies![0] }],
        updated: []
      };

      // Act
      const steps = orchestrator.generatePolicyMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('policy');
      expect(steps[0].name).toBe('policy_User_user_policy');
      expect(steps[0].sql).toContain('DROP POLICY');
      expect(steps[0].rollbackSql).toContain('CREATE POLICY');
    });

    it('should generate steps for updated policies', () => {
      // Arrange
      const oldPolicy = createTestPolicy('user_policy', 'public');
      const newPolicy = { ...oldPolicy, to: 'authenticated' };
      
      const model: Model = {
        ...createTestModel('User'),
        policies: [newPolicy]
      };
      
      const diff = {
        added: [],
        removed: [],
        updated: [{
          model,
          policy: newPolicy,
          previousPolicy: oldPolicy
        }]
      };

      // Act
      const steps = orchestrator.generatePolicyMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(2); // Drop old + Create new
      
      // Check first step (DROP)
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('policy');
      expect(steps[0].name).toBe('policy_User_user_policy_drop');
      expect(steps[0].sql).toContain('DROP POLICY');
      expect(steps[0].rollbackSql).toContain('CREATE POLICY');
      expect(steps[0].rollbackSql).toContain('TO public');
      
      // Check second step (CREATE)
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('policy');
      expect(steps[1].name).toBe('policy_User_user_policy_create');
      expect(steps[1].sql).toContain('CREATE POLICY');
      expect(steps[1].sql).toContain('TO authenticated');
      expect(steps[1].rollbackSql).toContain('DROP POLICY');
    });
  });
}); 