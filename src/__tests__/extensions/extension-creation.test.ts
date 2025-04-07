import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Extension Creation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for installing pgcrypto extension', () => {
    // Create a raw schema with the pgcrypto extension
    const rawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: true,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('pgcrypto');
    expect(migration.steps[0].sql).toBe('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  });

  test('should generate migration for installing postgis extension', () => {
    // Create a raw schema with the postgis extension
    const rawSchema = `
      // PostgreSQL Schema Definition
      extension postgis
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: true,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('postgis');
    expect(migration.steps[0].sql).toBe('CREATE EXTENSION IF NOT EXISTS "postgis";');
  });

  test('should generate migration for installing uuid-ossp extension', () => {
    // Create a raw schema with the uuid-ossp extension
    const rawSchema = `
      // PostgreSQL Schema Definition
      extension uuid-ossp
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: true,
      includeEnums: false,
      includeTables: false,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('uuid-ossp');
    expect(migration.steps[0].sql).toBe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  });

  test('should generate migration for installing multiple extensions', () => {
    // Create a raw schema with multiple extensions
    const rawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto
      extension postgis
      extension uuid-ossp
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
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
    const pgcryptoStep = migration.steps.find(step => step.name === 'pgcrypto');
    expect(pgcryptoStep?.sql).toBe('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    
    const postgisStep = migration.steps.find(step => step.name === 'postgis');
    expect(postgisStep?.sql).toBe('CREATE EXTENSION IF NOT EXISTS "postgis";');
    
    const uuidOsspStep = migration.steps.find(step => step.name === 'uuid-ossp');
    expect(uuidOsspStep?.sql).toBe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  });
}); 