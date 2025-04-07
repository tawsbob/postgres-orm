import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Extension Removal Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for removing pgcrypto extension', () => {
    // Create schemas for the diff
    const fromRawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto
    `;

    const toRawSchema = `
      // PostgreSQL Schema Definition
      // No extensions
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, fromRawSchema);
    const toSchema = schemaParser.parseSchema(undefined, toRawSchema);

    // Generate the migration using diff
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: true,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('pgcrypto');
    expect(migration.steps[0].sql).toBe('DROP EXTENSION IF EXISTS "pgcrypto";');
    expect(migration.steps[0].rollbackSql).toBe('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  });

  test('should generate migration for removing multiple extensions', () => {
    // Create schemas for the diff
    const fromRawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto
      extension postgis
      extension uuid-ossp
    `;

    const toRawSchema = `
      // PostgreSQL Schema Definition
      // No extensions
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, fromRawSchema);
    const toSchema = schemaParser.parseSchema(undefined, toRawSchema);

    // Generate the migration using diff
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: true,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(3);
    
    // Check for each extension
    const extensionNames = migration.steps.map(step => step.name);
    expect(extensionNames).toContain('pgcrypto');
    expect(extensionNames).toContain('postgis');
    expect(extensionNames).toContain('uuid-ossp');
    
    // Verify SQL for each extension
    migration.steps.forEach(step => {
      expect(step.type).toBe('drop');
      expect(step.objectType).toBe('extension');
      expect(step.sql).toBe(`DROP EXTENSION IF EXISTS "${step.name}";`);
      expect(step.rollbackSql).toBe(`CREATE EXTENSION IF NOT EXISTS "${step.name}";`);
    });
  });

  test('should generate migration for removing extension with version specification', () => {
    // Create schemas for the diff
    const fromRawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto (version='1.3')
    `;

    const toRawSchema = `
      // PostgreSQL Schema Definition
      // No extensions
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, fromRawSchema);
    const toSchema = schemaParser.parseSchema(undefined, toRawSchema);

    // Generate the migration using diff
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: true,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('pgcrypto');
    expect(migration.steps[0].sql).toBe('DROP EXTENSION IF EXISTS "pgcrypto";');
    expect(migration.steps[0].rollbackSql).toBe('CREATE EXTENSION IF NOT EXISTS "pgcrypto" VERSION \'1.3\';');
  });

  test('should generate migration for selective extension removal', () => {
    // Create schemas for the diff
    const fromRawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto
      extension postgis
      extension uuid-ossp
    `;

    const toRawSchema = `
      // PostgreSQL Schema Definition
      extension postgis
    `;

    // Parse the schemas
    const fromSchema = schemaParser.parseSchema(undefined, fromRawSchema);
    const toSchema = schemaParser.parseSchema(undefined, toRawSchema);

    // Generate the migration using diff
    const migration = migrationGenerator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: true,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(2); // Two removals
    
    // Check for extensions being removed
    const extensionNames = migration.steps.map(step => step.name);
    expect(extensionNames).toContain('pgcrypto');
    expect(extensionNames).toContain('uuid-ossp');
    expect(extensionNames).not.toContain('postgis'); // This one should be kept
    
    // Verify SQL for each extension
    migration.steps.forEach(step => {
      expect(step.type).toBe('drop');
      expect(step.objectType).toBe('extension');
      expect(step.sql).toBe(`DROP EXTENSION IF EXISTS "${step.name}";`);
    });
  });
}); 