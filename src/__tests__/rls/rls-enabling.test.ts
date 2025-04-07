import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Row Level Security (RLS) Enabling Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for enabling RLS on a table', () => {
    // Create a raw schema with a table that has RLS enabled
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        @@rowLevelSecurity(enabled: true)
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

    // Fourth step should be RLS no force
    expect(migration.steps[3].type).toBe('create');
    expect(migration.steps[3].objectType).toBe('rls');
    expect(migration.steps[3].name).toContain('rls_users');
    expect(migration.steps[3].sql).toBe('ALTER TABLE "public"."users" NO FORCE ROW LEVEL SECURITY;');
  });

  test('should generate migration for enabling RLS on multiple tables', () => {
    // Create a raw schema with multiple tables that have RLS enabled
    const rawSchema = `
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
    
    // Get all RLS enabling steps
    const rlsSteps = migration.steps.filter(step => 
      step.type === 'create' && 
      step.objectType === 'rls'
    );
    
    expect(rlsSteps.length).toBe(4); // Two ENABLE and two NO FORCE steps
    
    // Get ENABLE RLS steps
    const enableSteps = rlsSteps.filter(step => step.sql.includes('ENABLE ROW LEVEL SECURITY'));
    expect(enableSteps.length).toBe(2);
    
    // Get NO FORCE RLS steps
    const noForceSteps = rlsSteps.filter(step => step.sql.includes('NO FORCE ROW LEVEL SECURITY'));
    expect(noForceSteps.length).toBe(2);
    
    // Check that both tables have RLS enabled
    const enableTableNames = enableSteps.map(step => step.name);
    expect(enableTableNames.some(name => name.includes('users'))).toBe(true);
    expect(enableTableNames.some(name => name.includes('orders'))).toBe(true);
    
    // Check that both tables have NO FORCE RLS
    const noForceTableNames = noForceSteps.map(step => step.name);
    expect(noForceTableNames.some(name => name.includes('users'))).toBe(true);
    expect(noForceTableNames.some(name => name.includes('orders'))).toBe(true);
    
    // Verify SQL for each table's ENABLE RLS
    const usersEnableStep = enableSteps.find(step => step.name.includes('users'));
    expect(usersEnableStep?.sql).toBe('ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;');
    
    const ordersEnableStep = enableSteps.find(step => step.name.includes('orders'));
    expect(ordersEnableStep?.sql).toBe('ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;');
    
    // Verify SQL for each table's NO FORCE RLS
    const usersNoForceStep = noForceSteps.find(step => step.name.includes('users'));
    expect(usersNoForceStep?.sql).toBe('ALTER TABLE "public"."users" NO FORCE ROW LEVEL SECURITY;');
    
    const ordersNoForceStep = noForceSteps.find(step => step.name.includes('orders'));
    expect(ordersNoForceStep?.sql).toBe('ALTER TABLE "public"."orders" NO FORCE ROW LEVEL SECURITY;');
  });
}); 