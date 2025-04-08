import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Policy Migration Tests - Complex USING Expressions', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a policy with a complex condition', () => {
    // Create a raw schema with a table that has a policy with a complex condition
    const rawSchema = `
      // PostgreSQL Schema Definition
      model orders {
        id uuid pk
        user_id uuid
        total decimal(10,2)
        status varchar(50)
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("user_view_own_orders", {
          for: ["select"],
          to: "authenticated",
          using: "(user_id = auth.uid() AND status != 'DELETED')"
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
    expect(policy.name).toBe('policy_orders_user_view_own_orders');
    
    // Verify SQL - complex condition with AND
    expect(policy.sql).toContain('CREATE POLICY "user_view_own_orders" ON "public"."orders"');
    expect(policy.sql).toContain('USING ((user_id = auth.uid() AND status != \'DELETED\'))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "user_view_own_orders" ON "public"."orders"');
  });

  test('should generate migration for creating a policy with a subquery in USING expression', () => {
    // Create a raw schema with a table that has a policy with a subquery
    const rawSchema = `
      // PostgreSQL Schema Definition
      model posts {
        id uuid pk
        title varchar(100)
        content text
        author_id uuid
        team_id uuid
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("team_members_access", {
          for: ["select", "update"],
          to: "authenticated",
          using: "(author_id = auth.uid() OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))"
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
    expect(policy.name).toBe('policy_posts_team_members_access');
    
    // Verify SQL - with subquery
    expect(policy.sql).toContain('CREATE POLICY "team_members_access" ON "public"."posts"');
    expect(policy.sql).toContain('FOR SELECT, UPDATE');
    expect(policy.sql).toContain('TO authenticated');
    expect(policy.sql).toContain('USING ((author_id = auth.uid() OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "team_members_access" ON "public"."posts"');
  });

  test('should generate migration for creating a policy with a function call in USING expression', () => {
    // Create a raw schema with a table that has a policy with a function call
    const rawSchema = `
      // PostgreSQL Schema Definition
      model documents {
        id uuid pk
        title varchar(100)
        content text
        metadata jsonb
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("organization_documents", {
          for: ["select"],
          to: "authenticated",
          using: "(jsonb_extract_path_text(metadata, 'organization_id') = current_setting('app.organization_id', true))"
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
    expect(policy.name).toBe('policy_documents_organization_documents');
    
    // Verify SQL - with function call
    expect(policy.sql).toContain('CREATE POLICY "organization_documents" ON "public"."documents"');
    expect(policy.sql).toContain('USING ((jsonb_extract_path_text(metadata, \'organization_id\') = current_setting(\'app.organization_id\', true)))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "organization_documents" ON "public"."documents"');
  });

  test('should generate migration for creating a policy with a complex expression and CHECK clause', () => {
    // Create a raw schema with a table that has a policy with a complex expression and CHECK clause
    const rawSchema = `
      // PostgreSQL Schema Definition
      model employees {
        id uuid pk
        name varchar(100)
        department varchar(100)
        role varchar(50)
        manager_id uuid
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("manager_edit_department", {
          for: ["update"],
          to: "manager_role",
          using: "(EXISTS (SELECT 1 FROM employees e WHERE e.manager_id = auth.uid() AND e.id = employees.id))",
          check: "(NEW.department = OLD.department AND NEW.role IN ('STAFF', 'SENIOR', 'LEAD'))"
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
    expect(policy.name).toBe('policy_employees_manager_edit_department');
    
    // Verify SQL - with EXISTS subquery
    expect(policy.sql).toContain('CREATE POLICY "manager_edit_department" ON "public"."employees"');
    expect(policy.sql).toContain('FOR UPDATE');
    expect(policy.sql).toContain('TO manager_role');
    expect(policy.sql).toContain('USING ((EXISTS (SELECT 1 FROM employees e WHERE e.manager_id = auth.uid() AND e.id = employees.id)))');
    expect(policy.sql).toContain('WITH CHECK ((NEW.department = OLD.department AND NEW.role IN (\'STAFF\', \'SENIOR\', \'LEAD\')))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "manager_edit_department" ON "public"."employees"');
  });
}); 