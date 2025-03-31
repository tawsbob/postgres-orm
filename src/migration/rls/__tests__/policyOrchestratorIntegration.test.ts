import { PolicyOrchestrator } from '../policyOrchestrator';
import { Model, Policy } from '../../../parser/types';
import { SQLGenerator } from '../../sqlGenerator';

describe('PolicyOrchestrator Integration Tests', () => {
  let orchestrator: PolicyOrchestrator;

  beforeEach(() => {
    orchestrator = new PolicyOrchestrator();
  });

  // Helper function to create a test model
  const createTestModel = (name: string, policies: Policy[] = []): Model => ({
    name,
    fields: [
      {
        name: 'id',
        type: 'UUID',
        attributes: ['id', 'default'],
        defaultValue: 'gen_random_uuid()'
      },
      {
        name: 'name',
        type: 'VARCHAR',
        attributes: ['unique'],
        length: 255
      },
      {
        name: 'user_id',
        type: 'UUID',
        attributes: []
      }
    ],
    relations: [],
    rowLevelSecurity: {
      enabled: true,
      force: true
    },
    policies
  });

  // Test the full integration flow from comparison to SQL generation
  it('should correctly generate SQL for policy changes', () => {
    // Arrange
    const policyA: Policy = {
      name: 'users_policy',
      for: ['select', 'update'],
      to: 'authenticated',
      using: '(user_id = auth.uid())'
    };

    const policyB: Policy = {
      name: 'users_policy',
      for: ['select', 'update', 'delete'],
      to: 'authenticated',
      using: '(user_id = auth.uid() OR is_admin = true)'
    };

    const policyC: Policy = {
      name: 'admin_policy',
      for: 'all',
      to: 'admins',
      using: '(is_admin = true)'
    };

    // Set up models
    const fromModels: Model[] = [
      createTestModel('users', [policyA])
    ];

    const toModels: Model[] = [
      createTestModel('users', [policyB, policyC])
    ];

    // Act
    // 1. Compare the models to find policy differences
    const diff = orchestrator.comparePolicies(fromModels, toModels);
    
    // 2. Generate migration steps from the differences
    const steps = orchestrator.generatePolicyMigrationSteps(diff);

    // Assert
    // Verify we identified the right changes
    expect(diff.added.length).toBe(1); // Added the admin_policy
    expect(diff.added[0].policy.name).toBe('admin_policy');
    
    expect(diff.updated.length).toBe(1); // Updated the users_policy
    expect(diff.updated[0].policy.name).toBe('users_policy');
    expect(diff.updated[0].policy.for).toContain('delete'); // Added delete action
    
    expect(diff.removed.length).toBe(0); // No policies were removed
    
    // Verify the migration steps are correct
    expect(steps.length).toBe(3); // 2 for the updated policy (drop+create) and 1 for the added policy
    
    // Verify the updated policy steps (drop + create)
    const dropStep = steps.find(s => s.type === 'drop' && s.name.includes('users_policy'));
    expect(dropStep).toBeDefined();
    expect(dropStep!.sql).toContain('DROP POLICY IF EXISTS "users_policy" ON "public"."users"');
    
    const createStepForUpdated = steps.find(s => s.type === 'create' && s.name.includes('users_policy'));
    expect(createStepForUpdated).toBeDefined();
    expect(createStepForUpdated!.sql).toContain('CREATE POLICY "users_policy" ON "public"."users"');
    expect(createStepForUpdated!.sql).toContain('FOR SELECT, UPDATE, DELETE');
    expect(createStepForUpdated!.sql).toContain('(user_id = auth.uid() OR is_admin = true)');
    
    // Verify the added policy step
    const addedStep = steps.find(s => s.name.includes('admin_policy'));
    expect(addedStep).toBeDefined();
    expect(addedStep!.type).toBe('create');
    expect(addedStep!.sql).toContain('CREATE POLICY "admin_policy" ON "public"."users"');
    expect(addedStep!.sql).toContain('FOR ALL');
    expect(addedStep!.sql).toContain('TO admins');
    expect(addedStep!.sql).toContain('(is_admin = true)');
  });

  it('should correctly handle policies when models are added or removed', () => {
    // Arrange - prepare test models
    const userPolicy: Policy = {
      name: 'users_policy',
      for: ['select', 'update'],
      to: 'authenticated',
      using: '(user_id = auth.uid())'
    };

    const postPolicy: Policy = {
      name: 'posts_policy',
      for: ['select'],
      to: 'authenticated',
      using: '(author_id = auth.uid())'
    };

    // Setup models - from state has User model, to state has Post model
    const fromModels: Model[] = [
      createTestModel('users', [userPolicy])
    ];

    const toModels: Model[] = [
      createTestModel('posts', [postPolicy])
    ];

    // Act
    const diff = orchestrator.comparePolicies(fromModels, toModels);
    const steps = orchestrator.generatePolicyMigrationSteps(diff);

    // Assert
    expect(diff.added.length).toBe(1); // Added the post policy
    expect(diff.added[0].model.name).toBe('posts');
    expect(diff.added[0].policy.name).toBe('posts_policy');
    
    expect(diff.removed.length).toBe(1); // Removed the user policy
    expect(diff.removed[0].model.name).toBe('users');
    expect(diff.removed[0].policy.name).toBe('users_policy');
    
    expect(diff.updated.length).toBe(0); // No policies were updated
    
    // Verify the migration steps are correct
    expect(steps.length).toBe(2); // 1 for removing user policy, 1 for adding post policy
    
    // Verify the removal step
    const removeStep = steps.find(s => s.type === 'drop');
    expect(removeStep).toBeDefined();
    expect(removeStep!.sql).toContain('DROP POLICY IF EXISTS "users_policy" ON "public"."users"');
    
    // Verify the addition step
    const addStep = steps.find(s => s.type === 'create');
    expect(addStep).toBeDefined();
    expect(addStep!.sql).toContain('CREATE POLICY "posts_policy" ON "public"."posts"');
    expect(addStep!.sql).toContain('FOR SELECT');
    expect(addStep!.sql).toContain('TO authenticated');
    expect(addStep!.sql).toContain('(author_id = auth.uid())');
  });
}); 