import { SchemaParser } from '../../parser/schemaParser';
import { MigrationGenerator } from '../migrationGenerator';
import { MigrationWriter } from '../migrationWriter';
import fs from 'fs';
import path from 'path';

describe('MigrationGenerator', () => {
  let parser: SchemaParser;
  let generator: MigrationGenerator;
  let writer: MigrationWriter;
  let testMigrationsDir: string;

  beforeEach(() => {
    parser = new SchemaParser();
    generator = new MigrationGenerator();
    testMigrationsDir = path.join(__dirname, 'test-migrations');
    writer = new MigrationWriter(testMigrationsDir);
  });

  afterEach(() => {
    // Clean up test migrations directory
    if (fs.existsSync(testMigrationsDir)) {
      fs.rmSync(testMigrationsDir, { recursive: true, force: true });
    }
  });

  test('should generate migration for a simple schema', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);

    // Verify migration structure
    expect(migration).toHaveProperty('version');
    expect(migration).toHaveProperty('description');
    expect(migration).toHaveProperty('steps');
    expect(migration).toHaveProperty('timestamp');

    // Verify steps
    expect(migration.steps.length).toBeGreaterThan(0);

    // Verify extensions
    const extensionSteps = migration.steps.filter(step => step.objectType === 'extension');
    expect(extensionSteps.length).toBe(3); // pgcrypto, postgis, uuid-ossp

    // Verify enums
    const enumSteps = migration.steps.filter(step => step.objectType === 'enum');
    expect(enumSteps.length).toBe(2); // UserRole, OrderStatus

    // Verify tables
    const tableSteps = migration.steps.filter(step => step.objectType === 'table');
    expect(tableSteps.length).toBe(5); // User, Profile, Order, Product, ProductOrder

    // Verify constraints
    const constraintSteps = migration.steps.filter(step => step.objectType === 'constraint');
    expect(constraintSteps.length).toBeGreaterThan(0);

    // Verify indexes
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    expect(indexSteps.length).toBeGreaterThan(0);
  });

  test('should generate rollback migration', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);
    const rollback = generator.generateRollbackMigration(schema);

    // Verify rollback structure
    expect(rollback).toHaveProperty('version');
    expect(rollback).toHaveProperty('description', 'Rollback migration');
    expect(rollback).toHaveProperty('steps');
    expect(rollback).toHaveProperty('timestamp');

    // Verify steps are reversed
    expect(rollback.steps.length).toBe(migration.steps.length);
    expect(rollback.steps[0].sql).toBe(migration.steps[migration.steps.length - 1].rollbackSql);
  });

  test('should write migration file', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);
    const filePath = writer.writeMigration(migration);

    // Verify file exists
    expect(fs.existsSync(filePath)).toBe(true);

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify content structure
    expect(content).toContain('-- Migration:');
    expect(content).toContain('-- Version:');
    expect(content).toContain('-- Timestamp:');
    expect(content).toContain('-- Up Migration');
    expect(content).toContain('-- Down Migration');
    expect(content).toContain('BEGIN;');
    expect(content).toContain('COMMIT;');

    // Verify SQL statements
    expect(content).toContain('CREATE EXTENSION');
    expect(content).toContain('CREATE TYPE');
    expect(content).toContain('CREATE TABLE');
    expect(content).toContain('ALTER TABLE');
    expect(content).toContain('CREATE UNIQUE INDEX');
  });

  test('should handle custom schema name', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema, { schemaName: 'custom_schema' });

    // Verify SQL statements use custom schema
    migration.steps.forEach(step => {
      if (step.sql.includes('CREATE TABLE')) {
        expect(step.sql).toContain('"custom_schema"');
      }
      if (step.sql.includes('CREATE TYPE')) {
        expect(step.sql).toContain('"custom_schema"');
      }
    });
  });

  test('should respect migration options', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: false,
      includeConstraints: false,
      includeIndexes: false
    });

    // Verify no steps were generated
    expect(migration.steps.length).toBe(0);
  });

  test('should generate RLS steps', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);

    // Verify RLS steps
    const rlsSteps = migration.steps.filter(step => step.objectType === 'rls');
    expect(rlsSteps.length).toBeGreaterThan(0);

    // Find User table RLS steps
    const userRlsSteps = rlsSteps.filter(step => step.name.startsWith('rls_User_'));
    expect(userRlsSteps.length).toBe(2); // One for ENABLE RLS, one for FORCE RLS

    // Verify RLS SQL statements
    const enableRlsStep = userRlsSteps.find(step => 
      step.sql.includes('ENABLE ROW LEVEL SECURITY')
    );
    expect(enableRlsStep).toBeDefined();

    const forceRlsStep = userRlsSteps.find(step => 
      step.sql.includes('FORCE ROW LEVEL SECURITY')
    );
    expect(forceRlsStep).toBeDefined();

    // Verify rollback SQL
    expect(enableRlsStep?.rollbackSql).toContain('DISABLE ROW LEVEL SECURITY');
  });

  test('should respect RLS migration option', () => {
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema, {
      includeRLS: false
    });

    // Verify no RLS steps were generated
    const rlsSteps = migration.steps.filter(step => step.objectType === 'rls');
    expect(rlsSteps.length).toBe(0);
  });
}); 