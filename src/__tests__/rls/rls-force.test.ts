import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Row Level Security (RLS) Force Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for forcing RLS on a table', () => {
    // Create a raw schema with a table that has RLS enabled and forced
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true, force: true)
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(4); // One for table creation, one for unique index, two for RLS
    
    // First step should be table creation
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('users');
    
    // Second step should be unique index creation
    expect(migration.steps[1].type).toBe('create');
    expect(migration.steps[1].objectType).toBe('index');
    expect(migration.steps[1].name).toBe('idx_users_email');
    expect(migration.steps[1].sql).toContain('CREATE UNIQUE INDEX');
    
    // Third step should be RLS enabling
    expect(migration.steps[2].type).toBe('create');
    expect(migration.steps[2].objectType).toBe('rls');
    expect(migration.steps[2].name).toContain('rls_users');
    expect(migration.steps[2].sql).toBe('ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;');

    // Fourth step should be RLS force
    expect(migration.steps[3].type).toBe('create');
    expect(migration.steps[3].objectType).toBe('rls');
    expect(migration.steps[3].name).toContain('rls_users');
    expect(migration.steps[3].sql).toBe('ALTER TABLE "public"."users" FORCE ROW LEVEL SECURITY;');
  });

  test('should generate migration for forcing RLS on multiple tables', () => {
    // Create a raw schema with multiple tables that have RLS enabled and forced
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true, force: true)
      }

      model orders {
        id uuid pk
        user_id uuid
        total decimal(10,2)
        @@rowLevelSecurity(enabled: true, force: true)
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(7); // Two for table creation, one for unique index, four for RLS
    
    // Get all RLS steps
    const rlsSteps = migration.steps.filter(step => 
      step.type === 'create' && 
      step.objectType === 'rls'
    );
    
    expect(rlsSteps.length).toBe(4); // Two ENABLE and two FORCE steps
    
    // Get ENABLE RLS steps
    const enableSteps = rlsSteps.filter(step => step.sql.includes('ENABLE ROW LEVEL SECURITY'));
    expect(enableSteps.length).toBe(2);
    
    // Get FORCE RLS steps
    const forceSteps = rlsSteps.filter(step => step.sql.includes('FORCE ROW LEVEL SECURITY'));
    expect(forceSteps.length).toBe(2);
    
    // Check that both tables have RLS enabled
    const enableTableNames = enableSteps.map(step => step.name);
    expect(enableTableNames.some(name => name.includes('users'))).toBe(true);
    expect(enableTableNames.some(name => name.includes('orders'))).toBe(true);
    
    // Check that both tables have FORCE RLS
    const forceTableNames = forceSteps.map(step => step.name);
    expect(forceTableNames.some(name => name.includes('users'))).toBe(true);
    expect(forceTableNames.some(name => name.includes('orders'))).toBe(true);
    
    // Verify SQL for each table's ENABLE RLS
    const usersEnableStep = enableSteps.find(step => step.name.includes('users'));
    expect(usersEnableStep?.sql).toBe('ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;');
    
    const ordersEnableStep = enableSteps.find(step => step.name.includes('orders'));
    expect(ordersEnableStep?.sql).toBe('ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;');
    
    // Verify SQL for each table's FORCE RLS
    const usersForceStep = forceSteps.find(step => step.name.includes('users'));
    expect(usersForceStep?.sql).toBe('ALTER TABLE "public"."users" FORCE ROW LEVEL SECURITY;');
    
    const ordersForceStep = forceSteps.find(step => step.name.includes('orders'));
    expect(ordersForceStep?.sql).toBe('ALTER TABLE "public"."orders" FORCE ROW LEVEL SECURITY;');
  });

  test('should generate migration for changing RLS force setting', () => {
    // Create source schema with RLS enabled but not forced
    const fromSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true, force: false)
      }
    `;

    // Create target schema with RLS enabled and forced
    const toSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true, force: true)
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

    // Check that the migration contains only the force RLS step
    expect(migration.steps.length).toBe(1);
    
    // Check the step details
    const step = migration.steps[0];
    expect(step.type).toBe('alter');
    expect(step.objectType).toBe('rls');
    expect(step.name).toBe('rls_users_force');
    expect(step.sql).toBe('ALTER TABLE "public"."users" FORCE ROW LEVEL SECURITY;');
    expect(step.rollbackSql).toBe('ALTER TABLE "public"."users" NO FORCE ROW LEVEL SECURITY;');
  });
}); 