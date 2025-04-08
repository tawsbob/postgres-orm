import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Role Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a basic role', () => {
    // Create a raw schema with a simple role
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
    
    // Debug: Check if roles were parsed correctly
    console.log('Parsed schema roles:', JSON.stringify(schema.roles, null, 2));

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: true
    });
    
    // Debug: Check all migration steps
    console.log('Generated migration steps:', JSON.stringify(migration.steps, null, 2));

    // Filter to get only role steps
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');
    
    // Debug: Check filtered role steps
    console.log('Role steps:', JSON.stringify(roleSteps, null, 2));

    // Check that the migration contains the right role steps
    expect(roleSteps.length).toBe(2); // One for role creation, one for privileges
    
    // Check the role creation step
    const createStep = roleSteps[0];
    expect(createStep.type).toBe('create');
    expect(createStep.objectType).toBe('role');
    expect(createStep.name).toBe('userRole_create');
    expect(createStep.sql).toContain('CREATE ROLE "userRole"');
    
    // Check the privileges grant step
    const grantStep = roleSteps[1];
    expect(grantStep.type).toBe('create');
    expect(grantStep.objectType).toBe('role');
    expect(grantStep.name).toBe('userRole_grant_0');
    expect(grantStep.sql).toBe('GRANT SELECT, INSERT, UPDATE ON "public"."User" TO "userRole";');
    
    // Check rollback SQL
    expect(createStep.rollbackSql).toBe('DROP ROLE IF EXISTS "userRole";');
  });

  test('should generate migration for role with "all" privileges', () => {
    // Create a raw schema with a role that has "all" privileges
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      role adminRole {
        privileges: "all" on User
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: true
    });

    // Filter to get only role steps
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');

    // Check that the migration contains the right role steps
    expect(roleSteps.length).toBe(2); // One for role creation, one for privileges
    
    // Check the role creation step
    const createStep = roleSteps[0];
    expect(createStep.type).toBe('create');
    expect(createStep.objectType).toBe('role');
    expect(createStep.name).toBe('adminRole_create');
    expect(createStep.sql).toContain('CREATE ROLE "adminRole"');
    
    // Check the privileges grant step
    const grantStep = roleSteps[1];
    expect(grantStep.type).toBe('create');
    expect(grantStep.objectType).toBe('role');
    expect(grantStep.name).toBe('adminRole_grant_0');
    expect(grantStep.sql).toBe('GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."User" TO "adminRole";');
    
    // Check rollback SQL
    expect(createStep.rollbackSql).toBe('DROP ROLE IF EXISTS "adminRole";');
  });

  test('should generate migration for role with multiple table privileges', () => {
    // Create a raw schema with a role that has privileges on multiple tables
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      model Post {
        id UUID @id
        title VARCHAR(255)
        content TEXT
      }

      role editorRole {
        privileges: ["select", "insert", "update"] on User
        privileges: ["select", "insert", "update", "delete"] on Post
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: true
    });

    // Filter to get only role steps
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');

    // Check that the migration contains the right role steps
    expect(roleSteps.length).toBe(3); // One for role creation, two for privileges (one per table)
    
    // Check the role creation step
    const createStep = roleSteps[0];
    expect(createStep.type).toBe('create');
    expect(createStep.objectType).toBe('role');
    expect(createStep.name).toBe('editorRole_create');
    expect(createStep.sql).toContain('CREATE ROLE "editorRole"');
    
    // Check the privileges grant steps
    const userPrivilegeStep = roleSteps.find(step => 
      step.name === 'editorRole_grant_0' && step.sql.includes('User'));
    expect(userPrivilegeStep).toBeDefined();
    expect(userPrivilegeStep?.sql).toBe('GRANT SELECT, INSERT, UPDATE ON "public"."User" TO "editorRole";');
    
    const postPrivilegeStep = roleSteps.find(step => 
      step.name.startsWith('editorRole_grant_') && step.sql.includes('Post'));
    expect(postPrivilegeStep).toBeDefined();
    expect(postPrivilegeStep?.sql).toBe('GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."Post" TO "editorRole";');
    
    // Check rollback SQL
    expect(createStep.rollbackSql).toBe('DROP ROLE IF EXISTS "editorRole";');
  });
}); 