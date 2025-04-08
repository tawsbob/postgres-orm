import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';
import { Schema } from '../../parser/types';

describe('Role Modification Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for modifying role privileges', () => {
    // Create a source schema with a basic role
    const sourceRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      role userRole {
        privileges: ["select"] on User
      }
    `;

    // Create a target schema with modified privileges
    const targetRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      role userRole {
        privileges: ["select", "insert", "update"] on User
      }
    `;

    // Parse both schemas
    const sourceSchema = schemaParser.parseSchema(undefined, sourceRawSchema);
    const targetSchema = schemaParser.parseSchema(undefined, targetRawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(sourceSchema, targetSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeRoles: true
    });

    // Filter to get only role steps
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');

    // There should be at least 4 steps:
    // 1. Revoke original privileges
    // 2. Drop role
    // 3. Recreate role
    // 4. Grant new privileges
    expect(roleSteps.length).toBeGreaterThanOrEqual(4);
    
    // Check that the steps are in the right order with the right types
    const revokeStep = roleSteps.find(step => step.name.includes('revoke') && step.type === 'alter');
    const dropStep = roleSteps.find(step => step.name.includes('drop') && step.type === 'alter');
    const recreateStep = roleSteps.find(step => step.name.includes('recreate') && step.type === 'alter');
    const grantStep = roleSteps.find(step => step.name.includes('grant') && step.type === 'alter');
    
    expect(revokeStep).toBeDefined();
    expect(dropStep).toBeDefined();
    expect(recreateStep).toBeDefined();
    expect(grantStep).toBeDefined();
    
    // Verify SQL
    expect(revokeStep?.sql).toContain('REVOKE SELECT ON');
    expect(dropStep?.sql).toContain('DROP ROLE IF EXISTS "userRole"');
    expect(recreateStep?.sql).toContain('CREATE ROLE "userRole"');
    expect(grantStep?.sql).toContain('GRANT SELECT, INSERT, UPDATE ON');
  });

  test('should generate migration for adding a new privilege table to a role', () => {
    // Create a source schema with a role that has privileges on one table
    const sourceRawSchema = `
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
    `;

    // Create a target schema with privileges on two tables
    const targetRawSchema = `
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
        privileges: ["select"] on Post
      }
    `;

    // Parse both schemas
    const sourceSchema = schemaParser.parseSchema(undefined, sourceRawSchema);
    const targetSchema = schemaParser.parseSchema(undefined, targetRawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(sourceSchema, targetSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeRoles: true
    });

    // Filter to get only role steps
    const roleSteps = migration.steps.filter(step => step.objectType === 'role');

    // Check that the role is properly modified
    expect(roleSteps.length).toBeGreaterThanOrEqual(4);
    
    // Find and verify the step that grants privileges on the Post table
    const postGrantStep = roleSteps.find(step => 
      step.type === 'alter' && step.sql.includes('Post') && step.sql.includes('GRANT')
    );
    
    expect(postGrantStep).toBeDefined();
    expect(postGrantStep?.sql).toContain('GRANT SELECT ON "public"."Post" TO "userRole"');
  });

  test('should generate migration for removing a role completely', () => {
    // Create a source schema with a role
    const sourceRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }

      role adminRole {
        privileges: "all" on User
      }
    `;

    // Create a target schema without the role
    const targetRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id
        name VARCHAR(255)
      }
    `;

    // Parse both schemas
    const sourceSchema = schemaParser.parseSchema(undefined, sourceRawSchema);
    const targetSchema = schemaParser.parseSchema(undefined, targetRawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(sourceSchema, targetSchema, {
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
    
    // Check that the steps are in the right order with the right types
    const revokeStep = roleSteps.find(step => step.name.includes('revoke') && step.type === 'drop');
    const dropStep = roleSteps.find(step => step.name.includes('drop') && step.type === 'drop');
    
    expect(revokeStep).toBeDefined();
    expect(dropStep).toBeDefined();
    
    // Verify SQL
    expect(revokeStep?.sql).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE ON');
    expect(dropStep?.sql).toContain('DROP ROLE IF EXISTS "adminRole"');
    
    // Check rollback SQL
    expect(revokeStep?.rollbackSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON');
    expect(dropStep?.rollbackSql).toContain('CREATE ROLE "adminRole"');
  });
}); 