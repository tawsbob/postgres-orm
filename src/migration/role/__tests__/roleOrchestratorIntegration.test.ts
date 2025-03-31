import { Schema } from '../../../parser/types';
import { MigrationGenerator } from '../../migrationGenerator';

describe('RoleOrchestrator Integration', () => {
  let migrationGenerator: MigrationGenerator;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
  });

  // Helper function to create a test schema
  const createTestSchema = (withRoles: boolean = true): Schema => {
    const baseSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [], length: 100 }
          ],
          relations: []
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    if (withRoles) {
      baseSchema.roles = [
        {
          name: 'userRole',
          privileges: [
            {
              privileges: ['select'],
              on: 'User'
            }
          ]
        }
      ];
    }

    return baseSchema;
  };

  it('should generate migration steps for added roles', () => {
    // Arrange - Schema without roles to schema with roles
    const fromSchema = createTestSchema(false);
    const toSchema = createTestSchema(true);

    // Act
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeConstraints: false,
      includeIndexes: false,
      includeRLS: false,
      includePolicies: false,
      includeRoles: true
    });

    // Assert
    expect(migration.steps.length).toBe(2); // Role creation + privileges
    expect(migration.steps[0].objectType).toBe('role');
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].sql).toContain('CREATE ROLE "userRole"');
    expect(migration.steps[1].sql).toContain('GRANT SELECT ON "public"."User" TO "userRole"');
  });

  it('should generate migration steps for removed roles', () => {
    // Arrange - Schema with roles to schema without roles
    const fromSchema = createTestSchema(true);
    const toSchema = createTestSchema(false);

    // Act
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeConstraints: false,
      includeIndexes: false,
      includeRLS: false,
      includePolicies: false,
      includeRoles: true
    });

    // Assert
    expect(migration.steps.length).toBe(2); // Role drop + rollback privileges
    expect(migration.steps[0].objectType).toBe('role');
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].sql).toContain('DROP ROLE IF EXISTS "userRole"');
  });

  it('should generate migration steps for updated roles', () => {
    // Arrange - Schema with update role privileges
    const fromSchema = createTestSchema(true);
    const toSchema = createTestSchema(true);
    
    // Update the role in toSchema
    toSchema.roles[0].privileges[0].privileges = ['select', 'update'];

    // Act
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeConstraints: false,
      includeIndexes: false,
      includeRLS: false,
      includePolicies: false,
      includeRoles: true
    });

    // Assert - Should have steps to drop and recreate role with new privileges
    expect(migration.steps.length).toBeGreaterThan(2);
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');
    expect(roleSteps.length).toBeGreaterThan(2);
    
    // Check for role drop step
    const dropStep = roleSteps.find(step => step.name === 'userRole_drop');
    expect(dropStep).toBeDefined();
    expect(dropStep?.sql).toContain('DROP ROLE IF EXISTS "userRole"');
    
    // Check for role recreate step
    const recreateStep = roleSteps.find(step => step.name === 'userRole_recreate');
    expect(recreateStep).toBeDefined();
    expect(recreateStep?.sql).toContain('CREATE ROLE "userRole"');
    
    // Check for privileges grant step with updated privileges
    const grantStep = roleSteps.find(step => step.name === 'userRole_grant_0');
    expect(grantStep).toBeDefined();
    expect(grantStep?.sql).toContain('GRANT SELECT, UPDATE');
  });

  it('should include role migrations when using generateMigration', () => {
    // Arrange - Schema with roles
    const schema = createTestSchema(true);

    // Act
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeConstraints: false,
      includeIndexes: false,
      includeRLS: false,
      includePolicies: false,
      includeRoles: true
    });

    // Assert
    expect(migration.steps.length).toBe(2); // Role creation + privileges
    expect(migration.steps[0].objectType).toBe('role');
    expect(migration.steps[0].sql).toContain('CREATE ROLE "userRole"');
    expect(migration.steps[1].sql).toContain('GRANT SELECT ON "public"."User" TO "userRole"');
  });
}); 