import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Extension Version Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for installing pgcrypto with specific version', () => {
    // Create a raw schema with the pgcrypto extension and version
    const rawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto (version='1.3')
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
    expect(migration.steps[0].sql).toBe('CREATE EXTENSION IF NOT EXISTS "pgcrypto" VERSION \'1.3\';');
  });

  test('should generate migration for installing postgis with specific version', () => {
    // Create a raw schema with the postgis extension and version
    const rawSchema = `
      // PostgreSQL Schema Definition
      extension postgis (version='3.1.4')
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
    expect(migration.steps[0].sql).toBe('CREATE EXTENSION IF NOT EXISTS "postgis" VERSION \'3.1.4\';');
  });

  test('should generate migration for installing multiple extensions with versions', () => {
    // Create a raw schema with multiple extensions with versions
    const rawSchema = `
      // PostgreSQL Schema Definition
      extension pgcrypto (version='1.3')
      extension postgis (version='3.1.4')
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
    
    // Verify SQL for each extension
    const pgcryptoStep = migration.steps.find(step => step.name === 'pgcrypto');
    expect(pgcryptoStep?.sql).toBe('CREATE EXTENSION IF NOT EXISTS "pgcrypto" VERSION \'1.3\';');
    
    const postgisStep = migration.steps.find(step => step.name === 'postgis');
    expect(postgisStep?.sql).toBe('CREATE EXTENSION IF NOT EXISTS "postgis" VERSION \'3.1.4\';');
    
    const uuidOsspStep = migration.steps.find(step => step.name === 'uuid-ossp');
    expect(uuidOsspStep?.sql).toBe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  });
}); 