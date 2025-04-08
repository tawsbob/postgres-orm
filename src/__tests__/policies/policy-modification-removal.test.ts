import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';
import { Model, Policy } from '../../parser/types';
import { PolicyOrchestrator } from '../../migration/rls/policyOrchestrator';

describe('Policy Migration Tests - Modification and Removal', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;
  let policyOrchestrator: PolicyOrchestrator;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
    policyOrchestrator = new PolicyOrchestrator();
  });

  test('should generate migration for updating a policy', () => {
    // First schema with initial policy
    const initialSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("user_read_own", {
          for: ["select"],
          to: "authenticated",
          using: "(id = auth.uid())"
        })
      }
    `;
    
    // Second schema with updated policy
    const updatedSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        name varchar(100)
        email varchar(100) @unique
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("user_read_own", {
          for: ["select", "update"],
          to: "authenticated",
          using: "(id = auth.uid())"
        })
      }
    `;

    // Parse both schemas
    const initialParsedSchema = schemaParser.parseSchema(undefined, initialSchema);
    const updatedParsedSchema = schemaParser.parseSchema(undefined, updatedSchema);

    // Create diff between the schemas
    const diff = policyOrchestrator.comparePolicies(
      initialParsedSchema.models,
      updatedParsedSchema.models
    );

    // Generate migration steps
    const steps = policyOrchestrator.generatePolicyMigrationSteps(diff);

    // Verify diff
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.updated.length).toBe(1);
    
    // Verify steps
    expect(steps.length).toBe(2); // One for dropping old policy, one for creating new
    
    // First step should be dropping the old policy
    const dropStep = steps[0];
    expect(dropStep.type).toBe('drop');
    expect(dropStep.objectType).toBe('policy');
    expect(dropStep.name).toBe('policy_users_user_read_own_drop');
    expect(dropStep.sql).toContain('DROP POLICY IF EXISTS "user_read_own" ON "public"."users"');
    
    // Second step should be creating the new policy
    const createStep = steps[1];
    expect(createStep.type).toBe('create');
    expect(createStep.objectType).toBe('policy');
    expect(createStep.name).toBe('policy_users_user_read_own_create');
    expect(createStep.sql).toContain('CREATE POLICY "user_read_own" ON "public"."users"');
    expect(createStep.sql).toContain('FOR SELECT, UPDATE');
    expect(createStep.sql).toContain('TO authenticated');
    expect(createStep.sql).toContain('USING ((id = auth.uid()))');
  });

  test('should generate migration for adding CHECK clause to a policy', () => {
    // First schema with initial policy
    const initialSchema = `
      // PostgreSQL Schema Definition
      model posts {
        id uuid pk
        title varchar(100)
        content text
        author_id uuid
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("author_edit_own", {
          for: ["update"],
          to: "authenticated",
          using: "(author_id = auth.uid())"
        })
      }
    `;
    
    // Second schema with updated policy including a CHECK clause
    const updatedSchema = `
      // PostgreSQL Schema Definition
      model posts {
        id uuid pk
        title varchar(100)
        content text
        author_id uuid
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("author_edit_own", {
          for: ["update"],
          to: "authenticated",
          using: "(author_id = auth.uid())",
          check: "(NEW.author_id = OLD.author_id)"
        })
      }
    `;

    // Parse both schemas
    const initialParsedSchema = schemaParser.parseSchema(undefined, initialSchema);
    const updatedParsedSchema = schemaParser.parseSchema(undefined, updatedSchema);

    // Create diff between the schemas
    const diff = policyOrchestrator.comparePolicies(
      initialParsedSchema.models,
      updatedParsedSchema.models
    );

    // Generate migration steps
    const steps = policyOrchestrator.generatePolicyMigrationSteps(diff);

    // Verify diff
    expect(diff.updated.length).toBe(1);
    
    // Verify steps
    expect(steps.length).toBe(2); // One for dropping old policy, one for creating new
    
    // Second step should be creating the new policy with CHECK clause
    const createStep = steps[1];
    expect(createStep.type).toBe('create');
    expect(createStep.sql).toContain('WITH CHECK ((NEW.author_id = OLD.author_id))');
  });

  test('should generate migration for removing a policy', () => {
    // First schema with a policy
    const initialSchema = `
      // PostgreSQL Schema Definition
      model documents {
        id uuid pk
        title varchar(100)
        content text
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("admin_access", {
          for: "all",
          to: "admin",
          using: "true"
        })
      }
    `;
    
    // Second schema with the policy removed
    const updatedSchema = `
      // PostgreSQL Schema Definition
      model documents {
        id uuid pk
        title varchar(100)
        content text
        
        @@rowLevelSecurity(enabled: true)
      }
    `;

    // Parse both schemas
    const initialParsedSchema = schemaParser.parseSchema(undefined, initialSchema);
    const updatedParsedSchema = schemaParser.parseSchema(undefined, updatedSchema);

    // Create diff between the schemas
    const diff = policyOrchestrator.comparePolicies(
      initialParsedSchema.models,
      updatedParsedSchema.models
    );

    // Generate migration steps
    const steps = policyOrchestrator.generatePolicyMigrationSteps(diff);

    // Verify diff
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(1);
    expect(diff.updated.length).toBe(0);
    
    // Verify steps
    expect(steps.length).toBe(1); // One for dropping the policy
    
    // The step should be dropping the policy
    const dropStep = steps[0];
    expect(dropStep.type).toBe('drop');
    expect(dropStep.objectType).toBe('policy');
    expect(dropStep.name).toBe('policy_documents_admin_access');
    expect(dropStep.sql).toContain('DROP POLICY IF EXISTS "admin_access" ON "public"."documents"');
  });

  test('should generate migration for changing the role a policy applies to', () => {
    // First schema with policy for one role
    const initialSchema = `
      // PostgreSQL Schema Definition
      model products {
        id uuid pk
        name varchar(100)
        price decimal(10,2)
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("manage_products", {
          for: "all",
          to: "product_manager",
          using: "true"
        })
      }
    `;
    
    // Second schema with policy changed to a different role
    const updatedSchema = `
      // PostgreSQL Schema Definition
      model products {
        id uuid pk
        name varchar(100)
        price decimal(10,2)
        
        @@rowLevelSecurity(enabled: true)
        
        @@policy("manage_products", {
          for: "all",
          to: "admin_role",
          using: "true"
        })
      }
    `;

    // Parse both schemas
    const initialParsedSchema = schemaParser.parseSchema(undefined, initialSchema);
    const updatedParsedSchema = schemaParser.parseSchema(undefined, updatedSchema);

    // Create diff between the schemas
    const diff = policyOrchestrator.comparePolicies(
      initialParsedSchema.models,
      updatedParsedSchema.models
    );

    // Generate migration steps
    const steps = policyOrchestrator.generatePolicyMigrationSteps(diff);

    // Verify diff
    expect(diff.updated.length).toBe(1);
    
    // Verify steps
    expect(steps.length).toBe(2); // One for dropping old policy, one for creating new
    
    // First step should be dropping the old policy
    const dropStep = steps[0];
    expect(dropStep.sql).toContain('DROP POLICY IF EXISTS "manage_products" ON "public"."products"');
    expect(dropStep.rollbackSql).toContain('TO product_manager');
    
    // Second step should be creating the new policy
    const createStep = steps[1];
    expect(createStep.sql).toContain('CREATE POLICY "manage_products" ON "public"."products"');
    expect(createStep.sql).toContain('TO admin_role');
  });
}); 