import { Role } from '../../../parser/types';
import { RoleOrchestrator } from '../roleOrchestrator';

describe('RoleOrchestrator', () => {
  let orchestrator: RoleOrchestrator;

  // Helper function to create a test role
  const createTestRole = (name: string, models: string[] = ['User'], privileges: string[] = ['select']): Role => {
    return {
      name,
      privileges: models.map(model => ({
        privileges: privileges as any[],
        on: model
      }))
    };
  };

  beforeEach(() => {
    orchestrator = new RoleOrchestrator();
  });

  describe('compareRoles', () => {
    it('should detect added roles', () => {
      // Arrange
      const fromRoles: Role[] = [];
      const toRoles: Role[] = [createTestRole('userRole')];

      // Act
      const result = orchestrator.compareRoles(fromRoles, toRoles);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].name).toBe('userRole');
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('should detect removed roles', () => {
      // Arrange
      const fromRoles: Role[] = [createTestRole('userRole')];
      const toRoles: Role[] = [];

      // Act
      const result = orchestrator.compareRoles(fromRoles, toRoles);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].name).toBe('userRole');
      expect(result.updated.length).toBe(0);
    });

    it('should detect updated role privileges (different action)', () => {
      // Arrange
      const fromRoles: Role[] = [createTestRole('userRole', ['User'], ['select'])];
      const toRoles: Role[] = [createTestRole('userRole', ['User'], ['select', 'update'])];

      // Act
      const result = orchestrator.compareRoles(fromRoles, toRoles);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].role.name).toBe('userRole');
      expect(result.updated[0].role.privileges[0].privileges).toContain('update');
    });

    it('should detect updated role privileges (different table)', () => {
      // Arrange
      const fromRoles: Role[] = [createTestRole('userRole', ['User'], ['select'])];
      const toRoles: Role[] = [createTestRole('userRole', ['Profile'], ['select'])];

      // Act
      const result = orchestrator.compareRoles(fromRoles, toRoles);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].role.name).toBe('userRole');
      expect(result.updated[0].role.privileges[0].on).toBe('Profile');
    });

    it('should detect updated role privileges (added additional table)', () => {
      // Arrange
      const fromRoles: Role[] = [createTestRole('userRole', ['User'], ['select'])];
      
      const toRole = createTestRole('userRole', ['User'], ['select']);
      toRole.privileges.push({
        privileges: ['select'] as any[],
        on: 'Profile'
      });
      
      const toRoles: Role[] = [toRole];

      // Act
      const result = orchestrator.compareRoles(fromRoles, toRoles);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].role.name).toBe('userRole');
      expect(result.updated[0].role.privileges.length).toBe(2);
      expect(result.updated[0].role.privileges[1].on).toBe('Profile');
    });

    it('should not detect changes for identical roles', () => {
      // Arrange
      const fromRoles: Role[] = [createTestRole('userRole', ['User'], ['select'])];
      const toRoles: Role[] = [createTestRole('userRole', ['User'], ['select'])];

      // Act
      const result = orchestrator.compareRoles(fromRoles, toRoles);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });
  });

  describe('generateRoleMigrationSteps', () => {
    it('should generate steps for added roles', () => {
      // Arrange
      const diff = {
        added: [createTestRole('userRole')],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generateRoleMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(2); // One for role creation, one for privileges
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('role');
      expect(steps[0].name).toBe('userRole_create');
      expect(steps[0].sql).toContain('CREATE ROLE "userRole"');
      expect(steps[0].rollbackSql).toContain('DROP ROLE IF EXISTS "userRole"');
      
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('role');
      expect(steps[1].name).toBe('userRole_grant_0');
      expect(steps[1].sql).toContain('GRANT SELECT ON "public"."User" TO "userRole"');
    });

    it('should generate steps for removed roles', () => {
      // Arrange
      const diff = {
        added: [],
        removed: [createTestRole('userRole')],
        updated: []
      };

      // Act
      const steps = orchestrator.generateRoleMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(2); // One for role deletion, one for rollback privileges
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('role');
      expect(steps[0].name).toBe('userRole');
      expect(steps[0].sql).toContain('DROP ROLE IF EXISTS "userRole"');
      expect(steps[0].rollbackSql).toContain('CREATE ROLE "userRole"');
    });

    it('should generate steps for updated roles', () => {
      // Arrange
      const oldRole = createTestRole('userRole', ['User'], ['select']);
      const newRole = createTestRole('userRole', ['User'], ['select', 'update']);
      
      const diff = {
        added: [],
        removed: [],
        updated: [{
          role: newRole,
          previousRole: oldRole
        }]
      };

      // Act
      const steps = orchestrator.generateRoleMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(4); // Drop, recreate, grant, rollback
      expect(steps[0].type).toBe('alter');
      expect(steps[0].objectType).toBe('role');
      expect(steps[0].name).toBe('userRole_drop');
      expect(steps[0].sql).toContain('DROP ROLE IF EXISTS "userRole"');
      
      expect(steps[1].type).toBe('alter');
      expect(steps[1].objectType).toBe('role');
      expect(steps[1].name).toBe('userRole_recreate');
      expect(steps[1].sql).toContain('CREATE ROLE "userRole"');
      
      expect(steps[2].type).toBe('alter');
      expect(steps[2].objectType).toBe('role');
      expect(steps[2].name).toBe('userRole_grant_0');
      expect(steps[2].sql).toContain('GRANT SELECT, UPDATE ON "public"."User" TO "userRole"');
    });
  });
}); 