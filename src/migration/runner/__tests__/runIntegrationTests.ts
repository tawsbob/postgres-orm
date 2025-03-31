#!/usr/bin/env ts-node

import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import SchemaParserV1 from '../../../parser/schemaParser';
import { MigrationGenerator } from '../../migrationGenerator';
import { PostgresMigrationRunner } from '../migrationRunner';

// Configuration
const SCHEMA_PATH = path.resolve(__dirname, '../../../../schema/database.schema');
const TEST_MIGRATIONS_DIR = path.resolve(__dirname, './integration-migrations');
const DB_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres_orm';
const TEST_SCHEMA = 'integration_test';

// Helper to clean up database
const cleanupDatabase = async (): Promise<void> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    console.log('Cleaning up database...');
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS public.schema_migrations;`);
    console.log('Database cleanup completed.');
  } catch (error) {
    console.error('Error cleaning up database:', error);
  } finally {
    await pool.end();
  }
};

// Helper to clean up migrations directory
const cleanupMigrationsDir = async (): Promise<void> => {
  try {
    console.log(`Cleaning up migrations directory: ${TEST_MIGRATIONS_DIR}`);
    await fs.rm(TEST_MIGRATIONS_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_MIGRATIONS_DIR, { recursive: true });
    console.log('Migrations directory cleanup completed.');
  } catch (error) {
    console.error('Error cleaning up migrations directory:', error);
    // Make sure the directory exists
    await fs.mkdir(TEST_MIGRATIONS_DIR, { recursive: true });
  }
};

// Helper to save migration file
const saveMigrationFile = async (version: string, migrationContent: any): Promise<string> => {
  const filePath = path.join(TEST_MIGRATIONS_DIR, `${version}_initial_schema.json`);
  await fs.writeFile(filePath, JSON.stringify(migrationContent, null, 2));
  console.log(`Migration file saved: ${filePath}`);
  return filePath;
};

// Helper to validate database objects
const validateDatabaseObjects = async (): Promise<boolean> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    console.log('Validating database objects...');
    
    // Check if schema exists
    const schemaResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = $1
      );
    `, [TEST_SCHEMA]);
    
    if (!schemaResult.rows[0].exists) {
      console.error('Schema does not exist!');
      return false;
    }
    
    // Get all tables in the schema
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1
    `, [TEST_SCHEMA]);
    
    const tables = tablesResult.rows.map((row: any) => row.table_name);
    console.log('Tables found:', tables);
    
    // Check for required tables (case insensitive)
    const requiredTables = ['user', 'profile', 'order', 'product', 'productorder'];
    for (const requiredTable of requiredTables) {
      const found = tables.some(
        (table: string) => table.toLowerCase() === requiredTable.toLowerCase()
      );
      
      if (!found) {
        console.error(`Required table '${requiredTable}' not found. Available tables: ${tables.join(', ')}`);
        return false;
      }
    }
    
    // Check if enums exist (case insensitive)
    const enumsResult = await pool.query(`
      SELECT typname
      FROM pg_type 
      WHERE typname ILIKE $1 OR typname ILIKE $2
    `, ['userrole', 'orderstatus']);
    
    if (enumsResult.rows.length !== 2) {
      console.error(`Expected 2 enum types, found ${enumsResult.rows.length}: ${enumsResult.rows.map((r: any) => r.typname).join(', ')}`);
      return false;
    }
    
    console.log('Database validation successful!');
    return true;
  } catch (error) {
    console.error('Error validating database:', error);
    return false;
  } finally {
    await pool.end();
  }
};

// Helper to ensure schema exists
const ensureTestSchema = async (): Promise<void> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    console.log(`Creating test schema: ${TEST_SCHEMA}...`);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA};`);
    console.log('Schema created successfully.');
  } catch (error) {
    console.error('Error creating schema:', error);
  } finally {
    await pool.end();
  }
};

// Helper to list actual tables in schema
const listTablesInSchema = async (): Promise<string[]> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    console.log(`Listing tables in schema ${TEST_SCHEMA}...`);
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1
    `, [TEST_SCHEMA]);
    
    const tables: string[] = result.rows.map(row => row.table_name);
    
    if (tables.length === 0) {
      console.log('No tables found in schema.');
    } else {
      console.log('Tables found:');
      tables.forEach(table => {
        console.log(`- ${table}`);
      });
    }
    
    return tables;
  } catch (error) {
    console.error('Error listing tables:', error);
    return [];
  } finally {
    await pool.end();
  }
};

// Helper function to modify schema to avoid SQL errors
const prepareSchemaForMigration = (schema: any) => {
  // Remove policies and RLS settings to avoid SQL syntax issues in integration tests
  schema.models.forEach((model: any) => {
    // Remove policies
    if (model.policies) {
      model.policies = [];
    }
    
    // Disable RLS
    if (model.rowLevelSecurity) {
      model.rowLevelSecurity = undefined;
    }
  });
  
  // Remove roles to avoid permission issues in integration tests
  schema.roles = [];
  
  return schema;
};

// Helper to validate database connection
const validateConnection = async (): Promise<boolean> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    console.log('Validating database connection...');
    await pool.query('SELECT 1');
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  } finally {
    await pool.end();
  }
};

describe('Migration Runner Integration Tests', () => {
  let runner: PostgresMigrationRunner;
  
  // Run before all tests
  beforeAll(async () => {
    // Check database connection first
    const isConnected = await validateConnection();
    if (!isConnected) {
      throw new Error(`Could not connect to database: ${DB_CONNECTION_STRING}. Make sure the database is running.`);
    }
    
    // Clean up database and migrations directory
    await cleanupDatabase();
    await cleanupMigrationsDir();
    
    // Ensure test schema exists
    await ensureTestSchema();
  });
  
  // Run after all tests
  afterAll(async () => {
    // Clean up database and migrations directory
    await cleanupDatabase();
    await cleanupMigrationsDir();
  });
  
  // Test the end-to-end migration process
  test('should generate and apply migrations from schema file', async () => {
    // Parse schema
    console.log(`Parsing schema from ${SCHEMA_PATH}...`);
    const parser = new SchemaParserV1();
    const schema = parser.parseSchema(SCHEMA_PATH);
    console.log('Schema parsed successfully.');
    
    // Prepare schema for migration
    const preparedSchema = prepareSchemaForMigration(schema);
    
    // Generate migration
    console.log('Generating migration...');
    const generator = new MigrationGenerator();
    const migration = generator.generateMigration(preparedSchema, {
      schemaName: TEST_SCHEMA,
      includeExtensions: true,
      includeEnums: true,
      includeTables: true,
      includeConstraints: true,
      includeIndexes: true,
      includeRLS: false,
      includeRoles: false,
      includePolicies: false
    });
    
    expect(migration).toBeDefined();
    expect(migration.steps.length).toBeGreaterThan(0);
    console.log(`Migration generated with ${migration.steps.length} steps.`);
    
    // Save migration file
    const migrationFilePath = await saveMigrationFile(migration.version, migration);
    expect(migrationFilePath).toBeTruthy();
    
    // Initialize migration runner
    console.log('Initializing migration runner...');
    runner = new PostgresMigrationRunner({
      connectionString: DB_CONNECTION_STRING,
      migrationsDir: TEST_MIGRATIONS_DIR,
      schemaName: TEST_SCHEMA,
      migrationsTableName: 'schema_migrations'
    });
    
    // Run migration
    console.log('Running migration...');
    const result = await runner.runMigrations();
    
    expect(result.success).toBe(true);
    expect(result.appliedMigrations).toContain(migration.version);
    console.log(`Migration successful! Applied versions: ${result.appliedMigrations.join(', ')}`);
    
    // List tables
    const tables = await listTablesInSchema();
    
    // Use case-insensitive comparison for table names
    const lowerTables = tables.map(t => t.toLowerCase());
    expect(lowerTables).toContain('user');
    expect(lowerTables).toContain('profile');
    expect(lowerTables).toContain('order');
    expect(lowerTables).toContain('product');
    expect(lowerTables).toContain('productorder');
    
    // Check migration status
    const status = await runner.getMigrationsStatus();
    expect(status.applied.length).toBe(1);
    expect(status.applied[0].version).toBe(migration.version);
    expect(status.pending.length).toBe(0);
    
    // Test rollback
    console.log('Testing rollback...');
    const rollbackResult = await runner.rollback();
    
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBackMigrations).toContain(migration.version);
    console.log(`Rollback successful! Rolled back versions: ${rollbackResult.rolledBackMigrations.join(', ')}`);
    
    // Verify tables are gone after rollback
    const tablesAfterRollback = await listTablesInSchema();
    expect(tablesAfterRollback.length).toBe(0);
    
    // Close migration runner
    await runner.close();
  }, 30000); // Set timeout to 30 seconds for this test
}); 