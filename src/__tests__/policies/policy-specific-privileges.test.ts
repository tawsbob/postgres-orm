import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Policy Creation Migration Tests - Specific Privileges', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a SELECT policy', () => {
    // Create a raw schema with a table that has a policy for SELECT only
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("users_view_own", {
          for: ["select"],
          to: "authenticated",
          using: "(id = auth.uid())"
        })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includePolicies: true
    });

    // Check policy steps
    const policySteps = migration.steps.filter(step => step.objectType === 'policy');
    expect(policySteps.length).toBe(1);
    
    // Verify the policy details
    const policy = policySteps[0];
    expect(policy.type).toBe('create');
    expect(policy.objectType).toBe('policy');
    expect(policy.name).toBe('policy_users_users_view_own');
    
    // Verify SQL
    expect(policy.sql).toContain('CREATE POLICY "users_view_own" ON "public"."users"');
    expect(policy.sql).toContain('FOR SELECT');
    expect(policy.sql).toContain('TO authenticated');
    expect(policy.sql).toContain('USING ((id = auth.uid()))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "users_view_own" ON "public"."users"');
  });

  test('should generate migration for creating an UPDATE policy', () => {
    // Create a raw schema with a table that has a policy for UPDATE only
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("users_update_own", {
          for: ["update"],
          to: "authenticated",
          using: "(id = auth.uid())"
        })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includePolicies: true
    });

    // Check policy steps
    const policySteps = migration.steps.filter(step => step.objectType === 'policy');
    expect(policySteps.length).toBe(1);
    
    // Verify the policy details
    const policy = policySteps[0];
    expect(policy.type).toBe('create');
    expect(policy.objectType).toBe('policy');
    expect(policy.name).toBe('policy_users_users_update_own');
    
    // Verify SQL
    expect(policy.sql).toContain('CREATE POLICY "users_update_own" ON "public"."users"');
    expect(policy.sql).toContain('FOR UPDATE');
    expect(policy.sql).toContain('TO authenticated');
    expect(policy.sql).toContain('USING ((id = auth.uid()))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "users_update_own" ON "public"."users"');
  });

  test('should generate migration for creating a policy with multiple privileges', () => {
    // Create a raw schema with a table that has a policy for SELECT and UPDATE
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("users_own_data", {
          for: ["select", "update", "delete"],
          to: "authenticated",
          using: "(id = auth.uid())"
        })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includePolicies: true
    });

    // Check policy steps
    const policySteps = migration.steps.filter(step => step.objectType === 'policy');
    expect(policySteps.length).toBe(1);
    
    // Verify the policy details
    const policy = policySteps[0];
    expect(policy.type).toBe('create');
    expect(policy.objectType).toBe('policy');
    expect(policy.name).toBe('policy_users_users_own_data');
    
    // Verify SQL
    expect(policy.sql).toContain('CREATE POLICY "users_own_data" ON "public"."users"');
    expect(policy.sql).toContain('FOR SELECT, UPDATE, DELETE');
    expect(policy.sql).toContain('TO authenticated');
    expect(policy.sql).toContain('USING ((id = auth.uid()))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "users_own_data" ON "public"."users"');
  });

  test('should generate migration for creating an ALL privileges policy', () => {
    // Create a raw schema with a table that has a policy for all privileges
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("admin_access", {
          for: "all",
          to: "admin",
          using: "true"
        })
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false,
      includePolicies: true
    });

    // Check policy steps
    const policySteps = migration.steps.filter(step => step.objectType === 'policy');
    expect(policySteps.length).toBe(1);
    
    // Verify the policy details
    const policy = policySteps[0];
    expect(policy.type).toBe('create');
    expect(policy.objectType).toBe('policy');
    expect(policy.name).toBe('policy_users_admin_access');
    
    // Verify SQL
    expect(policy.sql).toContain('CREATE POLICY "admin_access" ON "public"."users"');
    expect(policy.sql).toContain('FOR ALL');
    expect(policy.sql).toContain('TO admin');
    expect(policy.sql).toContain('USING (true)');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "admin_access" ON "public"."users"');
  });
}); 