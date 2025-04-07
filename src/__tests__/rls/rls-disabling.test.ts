import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Row Level Security (RLS) Disabling Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for disabling RLS on a table', () => {
    // Create source schema with RLS enabled
    const fromSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true)
      }
    `;

    // Create target schema with RLS disabled
    const toSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
      }
    `;

    // Parse both schemas
    const fromSchemaObj = schemaParser.parseSchema(undefined, fromSchema);
    const toSchemaObj = schemaParser.parseSchema(undefined, toSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchemaObj, toSchemaObj, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    
    // Check the step details
    const step = migration.steps[0];
    expect(step.type).toBe('drop');
    expect(step.objectType).toBe('rls');
    expect(step.name).toBe('rls_users_disable');
    expect(step.sql).toBe('ALTER TABLE "public"."users" DISABLE ROW LEVEL SECURITY;');
    expect(step.rollbackSql).toBe('ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;');
  });

  test('should generate migration for disabling RLS on multiple tables', () => {
    // Create source schema with multiple tables that have RLS enabled
    const fromSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true)
      }

      model orders {
        id uuid pk
        user_id uuid
        total decimal(10,2)
        @@rowLevelSecurity(enabled: true)
      }
    `;

    // Create target schema with RLS disabled on all tables
    const toSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
      }

      model orders {
        id uuid pk
        user_id uuid
        total decimal(10,2)
      }
    `;

    // Parse both schemas
    const fromSchemaObj = schemaParser.parseSchema(undefined, fromSchema);
    const toSchemaObj = schemaParser.parseSchema(undefined, toSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchemaObj, toSchemaObj, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(2); // One step for each table
    
    // Get all RLS disabling steps
    const disableSteps = migration.steps.filter(step => 
      step.type === 'drop' && 
      step.objectType === 'rls' &&
      step.sql.includes('DISABLE ROW LEVEL SECURITY')
    );
    
    expect(disableSteps.length).toBe(2);
    
    // Check that both tables have RLS disabled
    const disableTableNames = disableSteps.map(step => step.name);
    expect(disableTableNames.some(name => name.includes('users'))).toBe(true);
    expect(disableTableNames.some(name => name.includes('orders'))).toBe(true);
    
    // Verify SQL for each table's DISABLE RLS
    const usersDisableStep = disableSteps.find(step => step.name.includes('users'));
    expect(usersDisableStep?.sql).toBe('ALTER TABLE "public"."users" DISABLE ROW LEVEL SECURITY;');
    expect(usersDisableStep?.rollbackSql).toBe('ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;');
    
    const ordersDisableStep = disableSteps.find(step => step.name.includes('orders'));
    expect(ordersDisableStep?.sql).toBe('ALTER TABLE "public"."orders" DISABLE ROW LEVEL SECURITY;');
    expect(ordersDisableStep?.rollbackSql).toBe('ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;');
  });

  test('should generate migration for disabling RLS with force enabled', () => {
    // Create source schema with RLS enabled and forced
    const fromSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true, force: true)
      }
    `;

    // Create target schema with RLS disabled
    const toSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
      }
    `;

    // Parse both schemas
    const fromSchemaObj = schemaParser.parseSchema(undefined, fromSchema);
    const toSchemaObj = schemaParser.parseSchema(undefined, toSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchemaObj, toSchemaObj, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(2); // One for DISABLE, one for NO FORCE
    
    // First step should be DISABLE RLS
    const disableStep = migration.steps[0];
    expect(disableStep.type).toBe('drop');
    expect(disableStep.objectType).toBe('rls');
    expect(disableStep.name).toBe('rls_users_disable');
    expect(disableStep.sql).toBe('ALTER TABLE "public"."users" DISABLE ROW LEVEL SECURITY;');
    expect(disableStep.rollbackSql).toBe('ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;');

    // Second step should be NO FORCE RLS
    const noForceStep = migration.steps[1];
    expect(noForceStep.type).toBe('drop');
    expect(noForceStep.objectType).toBe('rls');
    expect(noForceStep.name).toBe('rls_users_no_force');
    expect(noForceStep.sql).toBe('ALTER TABLE "public"."users" NO FORCE ROW LEVEL SECURITY;');
    expect(noForceStep.rollbackSql).toBe('ALTER TABLE "public"."users" FORCE ROW LEVEL SECURITY;');
  });
}); 