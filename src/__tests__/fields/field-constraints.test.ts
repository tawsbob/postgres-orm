import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Field Constraints Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for field with unique constraint', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        email varchar(100) @unique
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // The migration might generate multiple steps (table creation + unique constraint)
    expect(migration.steps.length).toBeGreaterThanOrEqual(1);
    
    // Find the table creation step
    const tableStep = migration.steps.find(step => step.objectType === 'table' && step.name === 'users');
    expect(tableStep).toBeDefined();
    expect(tableStep?.sql).toContain('"email" varchar');
    
    // Either the table creation includes UNIQUE or there's a separate constraint step
    const hasUniqueInTableCreation = tableStep?.sql.includes('UNIQUE');
    const hasUniqueConstraintStep = migration.steps.some(step => 
      step.objectType === 'constraint' && step.sql.includes('UNIQUE') && step.sql.includes('email')
    );
    
    expect(hasUniqueInTableCreation || hasUniqueConstraintStep).toBeTruthy();
  });

  test('should generate migration for field with non-nullable constraint', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model profiles {
        id uuid pk
        user_id uuid
        name varchar(100)
        bio text
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBeGreaterThanOrEqual(1);
    
    // Find the table creation step
    const tableStep = migration.steps.find(step => step.objectType === 'table' && step.name === 'profiles');
    expect(tableStep).toBeDefined();
    
    // All fields should be non-nullable by default
    expect(tableStep?.sql).toContain('"id" uuid');
    expect(tableStep?.sql).toContain('"user_id" uuid');
    expect(tableStep?.sql).toContain('"name" varchar');
    expect(tableStep?.sql).toContain('"bio" text');
    expect(tableStep?.sql).toContain('NOT NULL');
  });

  test('should generate migration for field with nullable constraint', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model profiles {
        id uuid pk
        name varchar(100)
        bio? text
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    expect(migration.steps.length).toBeGreaterThanOrEqual(1);
    
    // Find the table creation step
    const tableStep = migration.steps.find(step => step.objectType === 'table' && step.name === 'profiles');
    expect(tableStep).toBeDefined();
    
    // Check that name is non-nullable but bio is nullable
    const sql = tableStep?.sql || '';
    expect(sql).toContain('"name" varchar');
    expect(sql).toContain('"bio" text');
    
    // The bio field should not have NOT NULL, or it should explicitly say NULL is allowed
    // This depends on how the schema parser implements nullable fields
    expect(sql.match(/"bio" text NOT NULL/)).toBeNull();
  });

  test('should generate migration for field with combined constraints', () => {
    const rawSchema = `
      // PostgreSQL Schema Definition
      model users {
        id uuid pk
        email varchar(100) @unique
        username varchar(50) @unique
        first_name varchar(50)
        last_name varchar(50)
        phone? varchar(20)
        created_at timestamp @default(now())
      }
    `;

    const schema = schemaParser.parseSchema(undefined, rawSchema);
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // The migration might generate multiple steps (table creation + unique constraints)
    expect(migration.steps.length).toBeGreaterThanOrEqual(1);
    
    // Find the table creation step
    const tableStep = migration.steps.find(step => step.objectType === 'table' && step.name === 'users');
    expect(tableStep).toBeDefined();
    
    const sql = tableStep?.sql || '';
    
    // Check for fields
    expect(sql).toContain('"email" varchar');
    expect(sql).toContain('"username" varchar');
    expect(sql).toContain('"phone" varchar');
    expect(sql).toContain('"first_name" varchar');
    expect(sql).toContain('"last_name" varchar');
    expect(sql).toContain('"created_at" timestamp');
    
    // Check for unique constraints (either inline or as separate steps)
    const hasEmailUniqueInTableCreation = sql.includes('email') && sql.includes('UNIQUE');
    const hasUsernameUniqueInTableCreation = sql.includes('username') && sql.includes('UNIQUE');
    
    const hasEmailUniqueConstraintStep = migration.steps.some(step => 
      step.objectType === 'constraint' && step.sql.includes('UNIQUE') && step.sql.includes('email')
    );
    const hasUsernameUniqueConstraintStep = migration.steps.some(step => 
      step.objectType === 'constraint' && step.sql.includes('UNIQUE') && step.sql.includes('username')
    );
    
    expect(hasEmailUniqueInTableCreation || hasEmailUniqueConstraintStep).toBeTruthy();
    expect(hasUsernameUniqueInTableCreation || hasUsernameUniqueConstraintStep).toBeTruthy();
    
    // Check for nullable phone
    expect(sql.match(/"phone" varchar.*NOT NULL/)).toBeNull();
    
    // Check for non-nullable fields
    expect(sql.match(/first_name.*NOT NULL/)).toBeTruthy();
    expect(sql.match(/last_name.*NOT NULL/)).toBeTruthy();
    
    // Check for default value
    expect(sql).toContain('DEFAULT now()');
  });
}); 