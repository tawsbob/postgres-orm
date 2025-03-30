import SchemaParser from '../../parser/schemaParser';
import { MigrationGenerator } from '../migrationGenerator';
import { MigrationWriter } from '../migrationWriter';
import fs from 'fs';
import path from 'path';
import { Schema } from '../../parser/types';

describe('MigrationGenerator', () => {
  let parser: SchemaParser;
  let generator: MigrationGenerator;
  let writer: MigrationWriter;
  let testMigrationsDir: string;

  beforeEach(() => {
    parser = new SchemaParser();
    generator = new MigrationGenerator();
    testMigrationsDir = path.join(__dirname, 'test-migrations');
    writer = new MigrationWriter(testMigrationsDir);
  });

  afterEach(() => {
    // Clean up test migrations directory
    if (fs.existsSync(testMigrationsDir)) {
      fs.rmSync(testMigrationsDir, { recursive: true, force: true });
    }
  });

  test('should generate migration for a simple schema', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);

    // Verify migration structure
    expect(migration).toHaveProperty('version');
    expect(migration).toHaveProperty('description');
    expect(migration).toHaveProperty('steps');
    expect(migration).toHaveProperty('timestamp');

    // Verify steps
    expect(migration.steps.length).toBeGreaterThan(0);

    // Verify extensions
    const extensionSteps = migration.steps.filter(step => step.objectType === 'extension');
    expect(extensionSteps.length).toBe(3); // pgcrypto, postgis, uuid-ossp

    // Verify enums
    const enumSteps = migration.steps.filter(step => step.objectType === 'enum');
    expect(enumSteps.length).toBe(2); // UserRole, OrderStatus

    // Verify tables
    const tableSteps = migration.steps.filter(step => step.objectType === 'table');
    expect(tableSteps.length).toBe(5); // User, Profile, Order, Product, ProductOrder

    // Verify constraints
    const constraintSteps = migration.steps.filter(step => step.objectType === 'constraint');
    expect(constraintSteps.length).toBeGreaterThan(0);

    // Verify indexes
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    expect(indexSteps.length).toBeGreaterThan(0);
  });

  test('should generate rollback migration', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);
    const rollback = generator.generateRollbackMigration(schema);

    // Verify rollback structure
    expect(rollback).toHaveProperty('version');
    expect(rollback).toHaveProperty('description', 'Rollback migration');
    expect(rollback).toHaveProperty('steps');
    expect(rollback).toHaveProperty('timestamp');

    // Verify steps are reversed
    expect(rollback.steps.length).toBe(migration.steps.length);
    expect(rollback.steps[0].sql).toBe(migration.steps[migration.steps.length - 1].rollbackSql);
  });

  test('should write migration file', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);
    const filePath = writer.writeMigration(migration);

    // Verify file exists
    expect(fs.existsSync(filePath)).toBe(true);

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify content structure
    expect(content).toContain('-- Migration:');
    expect(content).toContain('-- Version:');
    expect(content).toContain('-- Timestamp:');
    expect(content).toContain('-- Up Migration');
    expect(content).toContain('-- Down Migration');
    expect(content).toContain('BEGIN;');
    expect(content).toContain('COMMIT;');

    // Verify SQL statements
    expect(content).toContain('CREATE EXTENSION');
    expect(content).toContain('CREATE TYPE');
    expect(content).toContain('CREATE TABLE');
    expect(content).toContain('ALTER TABLE');
    expect(content).toContain('CREATE UNIQUE INDEX');
  });

  test('should handle custom schema name', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema, { schemaName: 'custom_schema' });

    // Verify SQL statements use custom schema
    migration.steps.forEach(step => {
      if (step.sql.includes('CREATE TABLE')) {
        expect(step.sql).toContain('"custom_schema"');
      }
      if (step.sql.includes('CREATE TYPE')) {
        expect(step.sql).toContain('"custom_schema"');
      }
    });
  });

  test('should respect migration options', () => {
    const schema: Schema = {
      models: [],
      enums: [],
      extensions: [],
      roles: []
    };
    
    const migration = generator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeConstraints: false,
      includeIndexes: false,
      includeRLS: false,
      includeRoles: false
    });

    // Verify no steps were generated
    expect(migration.steps.length).toBe(0);
  });

  test('should generate RLS steps', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);

    // Verify RLS steps
    const rlsSteps = migration.steps.filter(step => step.objectType === 'rls');
    expect(rlsSteps.length).toBeGreaterThan(0);

    // Find User table RLS steps
    const userRlsSteps = rlsSteps.filter(step => step.name.startsWith('rls_User_'));
    expect(userRlsSteps.length).toBe(2); // One for ENABLE RLS, one for FORCE RLS

    // Verify RLS SQL statements
    const enableRlsStep = userRlsSteps.find(step => 
      step.sql.includes('ENABLE ROW LEVEL SECURITY')
    );
    expect(enableRlsStep).toBeDefined();

    const forceRlsStep = userRlsSteps.find(step => 
      step.sql.includes('FORCE ROW LEVEL SECURITY')
    );
    expect(forceRlsStep).toBeDefined();

    // Verify rollback SQL
    expect(enableRlsStep?.rollbackSql).toContain('DISABLE ROW LEVEL SECURITY');
  });

  test('should respect RLS migration option', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema, {
      includeRLS: false
    });

    // Verify no RLS steps were generated
    const rlsSteps = migration.steps.filter(step => step.objectType === 'rls');
    expect(rlsSteps.length).toBe(0);
  });

  test('should generate policy steps', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);

    // Verify policy steps
    const policySteps = migration.steps.filter(step => step.objectType === 'policy');
    expect(policySteps.length).toBeGreaterThan(0);

    // Find User table policy steps
    const userPolicySteps = policySteps.filter(step => step.name.startsWith('policy_User_'));
    expect(userPolicySteps.length).toBe(2); // Two policies: userIsolation and adminAccess

    // Check policy SQL
    const userIsolationPolicy = userPolicySteps.find(step => step.name === 'policy_User_userIsolation');
    expect(userIsolationPolicy).toBeDefined();
    expect(userIsolationPolicy?.sql).toContain('CREATE POLICY "userIsolation" ON "public"."User"');
    expect(userIsolationPolicy?.sql).toContain('FOR SELECT, UPDATE');
    expect(userIsolationPolicy?.sql).toContain('TO Profile');
    expect(userIsolationPolicy?.sql).toContain('current_setting(\'app.current_user_id\')');

    const adminAccessPolicy = userPolicySteps.find(step => step.name === 'policy_User_adminAccess');
    expect(adminAccessPolicy).toBeDefined();
    expect(adminAccessPolicy?.sql).toContain('CREATE POLICY "adminAccess" ON "public"."User"');
    expect(adminAccessPolicy?.sql).toContain('FOR ALL');
    expect(adminAccessPolicy?.sql).toContain('TO adminRole');
    expect(adminAccessPolicy?.sql).toContain('USING (true)');

    // Verify rollback SQL
    expect(userIsolationPolicy?.rollbackSql).toContain('DROP POLICY IF EXISTS "userIsolation" ON "public"."User"');
    expect(adminAccessPolicy?.rollbackSql).toContain('DROP POLICY IF EXISTS "adminAccess" ON "public"."User"');
  });
  
  test('should respect policy migration option', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema, {
      includePolicies: false
    });

    // Verify no policy steps were generated
    const policySteps = migration.steps.filter(step => step.objectType === 'policy');
    expect(policySteps.length).toBe(0);
  });

  test('should include policies in rollback migration', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);
    const rollback = generator.generateRollbackMigration(schema);

    // Find policy steps in original migration
    const policySteps = migration.steps.filter(step => step.objectType === 'policy');
    expect(policySteps.length).toBeGreaterThan(0);

    // Find policy steps in rollback migration
    const rollbackPolicySteps = rollback.steps.filter(step => step.objectType === 'policy');
    expect(rollbackPolicySteps.length).toBe(policySteps.length);

    // Verify SQL content is swapped
    const originalPolicy = policySteps.find(step => step.name === 'policy_User_userIsolation');
    const rollbackPolicy = rollbackPolicySteps.find(step => step.name === 'policy_User_userIsolation');
    
    expect(originalPolicy).toBeDefined();
    expect(rollbackPolicy).toBeDefined();
    expect(rollbackPolicy?.sql).toBe(originalPolicy?.rollbackSql);
    expect(rollbackPolicy?.rollbackSql).toBe(originalPolicy?.sql);
  });

  describe('generateMigration', () => {
    it('should generate migration steps for roles', () => {
      const schema: Schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: [
          {
            name: 'blogUser',
            privileges: [
              {
                privileges: ['select', 'insert', 'update'],
                on: 'Post'
              }
            ]
          },
          {
            name: 'admin',
            privileges: [
              {
                privileges: ['select', 'insert', 'update', 'delete'],
                on: 'Post'
              },
              {
                privileges: ['select'],
                on: 'User'
              }
            ]
          }
        ]
      };

      const migration = generator.generateMigration(schema);

      // Check role creation steps
      const roleSteps = migration.steps.filter(step => step.objectType === 'role');
      expect(roleSteps).toHaveLength(5); // 2 roles with 2 and 3 SQL statements each

      // Check blogUser role
      const blogUserSteps = roleSteps.filter(step => step.name.startsWith('blogUser_'));
      expect(blogUserSteps).toHaveLength(2);
      expect(blogUserSteps[0].sql).toContain('CREATE ROLE "blogUser"');
      expect(blogUserSteps[1].sql).toContain('GRANT SELECT, INSERT, UPDATE ON "public"."Post" TO "blogUser"');

      // Check admin role
      const adminSteps = roleSteps.filter(step => step.name.startsWith('admin_'));
      expect(adminSteps).toHaveLength(3);
      expect(adminSteps[0].sql).toContain('CREATE ROLE "admin"');
      expect(adminSteps[1].sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."Post" TO "admin"');
      expect(adminSteps[2].sql).toContain('GRANT SELECT ON "public"."User" TO "admin"');

      // Check rollback SQL
      blogUserSteps.forEach(step => {
        expect(step.rollbackSql).toBe('DROP ROLE IF EXISTS "blogUser";');
      });
      adminSteps.forEach(step => {
        expect(step.rollbackSql).toBe('DROP ROLE IF EXISTS "admin";');
      });
    });

    it('should not generate role steps when includeRoles is false', () => {
      const schema: Schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: [
          {
            name: 'blogUser',
            privileges: [
              {
                privileges: ['select', 'insert', 'update'],
                on: 'Post'
              }
            ]
          }
        ]
      };

      const migration = generator.generateMigration(schema, { includeRoles: false });
      const roleSteps = migration.steps.filter(step => step.objectType === 'role');
      expect(roleSteps).toHaveLength(0);
    });

    it('should handle roles with models and other schema elements', () => {
      const schema: Schema = {
        models: [
          {
            name: 'Post',
            fields: [
              {
                name: 'id',
                type: 'UUID',
                attributes: ['id']
              }
            ],
            relations: []
          }
        ],
        enums: [],
        extensions: [],
        roles: [
          {
            name: 'blogUser',
            privileges: [
              {
                privileges: ['select', 'insert', 'update'],
                on: 'Post'
              }
            ]
          }
        ]
      };

      const migration = generator.generateMigration(schema);

      // Check that we have both table and role steps
      const tableSteps = migration.steps.filter(step => step.objectType === 'table');
      const roleSteps = migration.steps.filter(step => step.objectType === 'role');

      expect(tableSteps).toHaveLength(1);
      expect(roleSteps).toHaveLength(2); // 1 role with 2 SQL statements

      // Verify order: table creation should come before role creation
      const tableStepIndex = migration.steps.findIndex(step => step.objectType === 'table');
      const roleStepIndex = migration.steps.findIndex(step => step.objectType === 'role');
      expect(tableStepIndex).toBeLessThan(roleStepIndex);
    });
  });

  describe('generateRollbackMigration', () => {
    it('should generate rollback steps for roles', () => {
      const schema: Schema = {
        models: [],
        enums: [],
        extensions: [],
        roles: [
          {
            name: 'blogUser',
            privileges: [
              {
                privileges: ['select', 'insert', 'update'],
                on: 'Post'
              }
            ]
          }
        ]
      };

      const migration = generator.generateRollbackMigration(schema);
      const roleSteps = migration.steps.filter(step => step.objectType === 'role');

      expect(roleSteps).toHaveLength(2); // 1 role with 2 SQL statements
      roleSteps.forEach(step => {
        expect(step.sql).toBe('DROP ROLE IF EXISTS "blogUser";');
        expect(step.rollbackSql).toContain('CREATE ROLE "blogUser"');
      });
    });
  });
}); 