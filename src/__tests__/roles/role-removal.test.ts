import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Role Removal Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for removing a basic role', () => {
    // Create a schema with a role
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      role userRole {
        privileges: ["select", "insert", "update"] on User
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate a migration to remove the role
    // To simulate role removal, we'll create a migration from the schema that contains the role 
    // to an empty schema
    const emptySchema = {
      models: schema.models,  // Keep models to ensure table exists
      enums: [],
      extensions: [],
      roles: []
    };

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(schema, emptySchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeRoles: true
    });

    // Filter to get only role steps
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');

    // There should be at least 2 steps:
    // 1. Revoke privileges 
    // 2. Drop role
    expect(roleSteps.length).toBeGreaterThanOrEqual(2);
    
    // Check the steps
    const revokeSteps = roleSteps.filter(step => step.name.includes('revoke'));
    const dropStep = roleSteps.find(step => step.name.includes('drop'));
    
    expect(revokeSteps.length).toBeGreaterThan(0);
    expect(dropStep).toBeDefined();
    
    // Verify SQL
    revokeSteps.forEach(step => {
      expect(step.sql).toContain('REVOKE');
      expect(step.sql).toContain('FROM "userRole"');
    });
    
    expect(dropStep?.sql).toBe('DROP ROLE IF EXISTS "userRole";');
    
    // Check rollback SQL
    expect(dropStep?.rollbackSql).toContain('CREATE ROLE "userRole"');
  });

  test('should generate migration for removing multiple roles', () => {
    // Create a schema with multiple roles
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }
      
      model Post {
        id UUID @id
        title VARCHAR(255)
      }

      role userRole {
        privileges: ["select", "insert"] on User
      }
      
      role adminRole {
        privileges: "all" on User
        privileges: "all" on Post
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate a migration to remove all roles
    const emptySchema = {
      models: schema.models,  // Keep models to ensure tables exist
      enums: [],
      extensions: [],
      roles: []
    };

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(schema, emptySchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeRoles: true
    });

    // Filter to get only role steps
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');

    // There should be steps for both roles
    expect(roleSteps.length).toBeGreaterThan(2);
    
    // Check the drop steps for both roles
    const userRoleDropStep = roleSteps.find(step => 
      step.name.includes('drop') && step.sql.includes('userRole')
    );
    
    const adminRoleDropStep = roleSteps.find(step => 
      step.name.includes('drop') && step.sql.includes('adminRole')
    );
    
    expect(userRoleDropStep).toBeDefined();
    expect(adminRoleDropStep).toBeDefined();
    
    // Verify SQL for user role
    expect(userRoleDropStep?.sql).toBe('DROP ROLE IF EXISTS "userRole";');
    expect(userRoleDropStep?.rollbackSql).toContain('CREATE ROLE "userRole"');
    
    // Verify SQL for admin role
    expect(adminRoleDropStep?.sql).toBe('DROP ROLE IF EXISTS "adminRole";');
    expect(adminRoleDropStep?.rollbackSql).toContain('CREATE ROLE "adminRole"');
    
    // Check that there are revoke statements for each privilege
    const userRoleRevokeStep = roleSteps.find(step => 
      step.name.includes('revoke') && step.sql.includes('userRole')
    );
    
    const adminRoleRevokeSteps = roleSteps.filter(step => 
      step.name.includes('revoke') && step.sql.includes('adminRole')
    );
    
    expect(userRoleRevokeStep).toBeDefined();
    expect(adminRoleRevokeSteps.length).toBeGreaterThanOrEqual(2); // At least one for each table
    
    // Verify that admin role revoke statements include both tables
    const userTableRevokeStep = adminRoleRevokeSteps.find(step => step.sql.includes('User'));
    const postTableRevokeStep = adminRoleRevokeSteps.find(step => step.sql.includes('Post'));
    
    expect(userTableRevokeStep).toBeDefined();
    expect(postTableRevokeStep).toBeDefined();
  });
}); 