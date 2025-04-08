import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Policy Migration Tests - Targeting Specific Roles', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for creating a policy targeting a specific role', () => {
    // Create a raw schema with a table that has a policy for a specific role
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("admin_all_access", {
          for: "all",
          to: "admin_role",
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
    expect(policy.name).toBe('policy_users_admin_all_access');
    
    // Verify SQL
    expect(policy.sql).toContain('CREATE POLICY "admin_all_access" ON "public"."users"');
    expect(policy.sql).toContain('FOR ALL');
    expect(policy.sql).toContain('TO admin_role');
    expect(policy.sql).toContain('USING (true)');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "admin_all_access" ON "public"."users"');
  });

  test('should generate migration for creating a policy targeting multiple roles', () => {
    // Create a raw schema with a table that has a policy for multiple roles
    const rawSchema = `
      // PostgreSQL Schema Definition
      model posts {
        id uuid pk
        title varchar(100)
        content text
        author_id uuid
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("editors_and_authors", {
          for: ["select", "update"],
          to: "editor_role, author_role",
          using: "(author_id = auth.uid() OR current_setting('app.role') = 'editor')"
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
    expect(policy.name).toBe('policy_posts_editors_and_authors');
    
    // Verify SQL
    expect(policy.sql).toContain('CREATE POLICY "editors_and_authors" ON "public"."posts"');
    expect(policy.sql).toContain('FOR SELECT, UPDATE');
    expect(policy.sql).toContain('TO editor_role, author_role');
    expect(policy.sql).toContain('USING ((author_id = auth.uid() OR current_setting(\'app.role\') = \'editor\'))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "editors_and_authors" ON "public"."posts"');
  });

  test('should generate migration for creating a policy targeting public', () => {
    // Create a raw schema with a table that has a policy for public
    const rawSchema = `
      // PostgreSQL Schema Definition
      model articles {
        id uuid pk
        title varchar(100)
        content text
        is_published boolean
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("public_read_published", {
          for: ["select"],
          to: "public",
          using: "(is_published = true)"
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
    expect(policy.name).toBe('policy_articles_public_read_published');
    
    // Verify SQL
    expect(policy.sql).toContain('CREATE POLICY "public_read_published" ON "public"."articles"');
    expect(policy.sql).toContain('FOR SELECT');
    expect(policy.sql).toContain('TO public');
    expect(policy.sql).toContain('USING ((is_published = true))');
    
    // Verify rollback SQL
    expect(policy.rollbackSql).toContain('DROP POLICY IF EXISTS "public_read_published" ON "public"."articles"');
  });

  test('should generate migration for creating multiple policies for different roles', () => {
    // Create a raw schema with a table that has multiple policies for different roles
    const rawSchema = `
      // PostgreSQL Schema Definition
      model documents {
        id uuid pk
        title varchar(100)
        content text
        owner_id uuid
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("owner_full_access", {
          for: "all",
          to: "authenticated",
          using: "(owner_id = auth.uid())"
        })
        
        @@policy("viewer_read_only", {
          for: ["select"],
          to: "viewer_role",
          using: "true"
        })
        
        @@policy("admin_super_access", {
          for: "all",
          to: "admin_role",
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
    expect(policySteps.length).toBe(3);
    
    // Get all policy names
    const policyNames = policySteps.map(step => step.name);
    expect(policyNames).toContain('policy_documents_owner_full_access');
    expect(policyNames).toContain('policy_documents_viewer_read_only');
    expect(policyNames).toContain('policy_documents_admin_super_access');
    
    // Check each policy
    const ownerPolicy = policySteps.find(step => step.name === 'policy_documents_owner_full_access');
    expect(ownerPolicy?.sql).toContain('TO authenticated');
    expect(ownerPolicy?.sql).toContain('FOR ALL');
    expect(ownerPolicy?.sql).toContain('USING ((owner_id = auth.uid()))');
    
    const viewerPolicy = policySteps.find(step => step.name === 'policy_documents_viewer_read_only');
    expect(viewerPolicy?.sql).toContain('TO viewer_role');
    expect(viewerPolicy?.sql).toContain('FOR SELECT');
    expect(viewerPolicy?.sql).toContain('USING (true)');
    
    const adminPolicy = policySteps.find(step => step.name === 'policy_documents_admin_super_access');
    expect(adminPolicy?.sql).toContain('TO admin_role');
    expect(adminPolicy?.sql).toContain('FOR ALL');
    expect(adminPolicy?.sql).toContain('USING (true)');
  });
}); 