import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { Schema } from '../../../parser/types';
import { MigrationGenerator } from '../../migrationGenerator';
import { PostgresMigrationRunner } from '../migrationRunner';
import { Migration } from '../../types';

// Configuration for extension management tests
const TEST_MIGRATIONS_DIR = path.resolve(__dirname, './extension-migrations');
const DB_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres_orm';
const TEST_SCHEMA = 'extension_test';
const VERBOSE = process.env.VERBOSE === 'true'; // Set to true for detailed logs

// Helper for conditional logging
const log = (message: string | any, ...args: any[]) => {
  if (VERBOSE) {
    console.log(message, ...args);
  }
};

// Helper to clean up database schema
const cleanupDatabase = async (): Promise<void> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    log('Cleaning up database...');
    await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS ${TEST_SCHEMA}.schema_migrations;`);
    log('Database cleanup completed.');
  } catch (error) {
    console.error('Error cleaning up database:', error);
  } finally {
    await pool.end();
  }
};

// Helper to clean up migrations directory
const cleanupMigrationsDir = async (): Promise<void> => {
  try {
    log(`Cleaning up migrations directory: ${TEST_MIGRATIONS_DIR}`);
    await fs.rm(TEST_MIGRATIONS_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_MIGRATIONS_DIR, { recursive: true });
    log('Migrations directory cleanup completed.');
  } catch (error) {
    console.error('Error cleaning up migrations directory:', error);
    // Make sure the directory exists
    await fs.mkdir(TEST_MIGRATIONS_DIR, { recursive: true });
  }
};

// Helper to save migration file
const saveMigrationFile = async (version: string, migrationContent: Migration): Promise<string> => {
  const filePath = path.join(TEST_MIGRATIONS_DIR, `${version}_extension_migration.json`);
  await fs.writeFile(filePath, JSON.stringify(migrationContent, null, 2));
  log(`Migration file saved: ${filePath}`);
  return filePath;
};

// Helper to check if extension is installed
const isExtensionInstalled = async (extensionName: string): Promise<boolean> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    log(`Checking if extension ${extensionName} is installed...`);
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_extension WHERE extname = $1
      );
    `, [extensionName]);
    
    const isInstalled = result.rows[0].exists;
    log(`Extension ${extensionName} is ${isInstalled ? 'installed' : 'not installed'}`);
    return isInstalled;
  } catch (error) {
    console.error(`Error checking extension ${extensionName}:`, error);
    return false;
  } finally {
    await pool.end();
  }
};

// Helper to check extension version
const getExtensionVersion = async (extensionName: string): Promise<string | null> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    log(`Checking version of extension ${extensionName}...`);
    const result = await pool.query(`
      SELECT extversion FROM pg_extension WHERE extname = $1
    `, [extensionName]);
    
    if (result.rows.length === 0) {
      log(`Extension ${extensionName} is not installed`);
      return null;
    }
    
    const version = result.rows[0].extversion;
    log(`Extension ${extensionName} is version ${version}`);
    return version;
  } catch (error) {
    console.error(`Error checking extension version for ${extensionName}:`, error);
    return null;
  } finally {
    await pool.end();
  }
};

// Helper to ensure test schema exists
const ensureTestSchema = async (): Promise<void> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    log(`Creating test schema: ${TEST_SCHEMA}...`);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA};`);
    log('Schema created successfully.');
  } catch (error) {
    console.error('Error creating schema:', error);
  } finally {
    await pool.end();
  }
};

// Helper to validate database connection
const validateConnection = async (): Promise<boolean> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    log('Validating database connection...');
    await pool.query('SELECT 1');
    log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  } finally {
    await pool.end();
  }
};

describe('Extension Management Integration Tests', () => {
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
    
    // Initialize migration runner
    runner = new PostgresMigrationRunner({
      connectionString: DB_CONNECTION_STRING,
      migrationsDir: TEST_MIGRATIONS_DIR,
      schemaName: TEST_SCHEMA,
      migrationsTableName: 'schema_migrations'
    });
    
    await runner.init();
  });
  
  // Run after all tests
  afterAll(async () => {
    // Close migration runner
    if (runner) {
      await runner.close();
    }
    
    // Clean up database and migrations directory
    await cleanupDatabase();
    await cleanupMigrationsDir();
  });
  
  // Test adding a single extension
  test('should add pg_trgm extension for text search functionality', async () => {
    // Create a schema with pg_trgm extension
    const schema: Schema = {
      models: [],
      enums: [],
      extensions: [{ name: 'pg_trgm' }],
      roles: []
    };
    
    // Generate migration
    const generator = new MigrationGenerator();
    const migration = generator.generateMigration(schema, {
      schemaName: TEST_SCHEMA,
      includeExtensions: true,
      includeEnums: false,
      includeTables: false
    });
    
    expect(migration).toBeDefined();
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('pg_trgm');
    
    // Save migration file
    await saveMigrationFile(migration.version, migration);
    
    // Run migration
    const result = await runner.runMigrations();
    expect(result.success).toBe(true);
    
    // Verify extension is installed
    const isInstalled = await isExtensionInstalled('pg_trgm');
    expect(isInstalled).toBe(true);
    
    // Test rollback
    const rollbackResult = await runner.rollback();
    expect(rollbackResult.success).toBe(true);
    
    // Verify extension is removed
    const isRemovedAfterRollback = await isExtensionInstalled('pg_trgm');
    expect(isRemovedAfterRollback).toBe(false);
  }, 30000);
  
  // Test adding extension with specific version
  test('should add hstore extension with specific version', async () => {
    // Create a schema with versioned hstore extension 
    const schema: Schema = {
      models: [],
      enums: [],
      extensions: [{ name: 'hstore', version: '1.4' }],
      roles: []
    };
    
    // Generate migration
    const generator = new MigrationGenerator();
    const migration = generator.generateMigration(schema, {
      schemaName: TEST_SCHEMA,
      includeExtensions: true,
      includeEnums: false,
      includeTables: false
    });
    
    expect(migration).toBeDefined();
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('hstore');
    expect(migration.steps[0].sql).toContain("VERSION '1.4'");
    
    // Save migration file
    await saveMigrationFile(migration.version, migration);
    
    // Run migration
    const result = await runner.runMigrations();
    expect(result.success).toBe(true);
    
    // Verify extension is installed
    const isInstalled = await isExtensionInstalled('hstore');
    expect(isInstalled).toBe(true);
    
    // Verify extension version
    const version = await getExtensionVersion('hstore');
    // Note: The actual version might be different depending on what's available in the database
    expect(version).not.toBeNull();
    
    // Test rollback
    const rollbackResult = await runner.rollback();
    expect(rollbackResult.success).toBe(true);
    
    // Verify extension is removed
    const isRemovedAfterRollback = await isExtensionInstalled('hstore');
    expect(isRemovedAfterRollback).toBe(false);
  }, 30000);
  
  // Test adding multiple extensions at once
  test('should add multiple extensions in one operation', async () => {
    // Create a schema with multiple extensions
    const schema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' },
        { name: 'hstore' },
        { name: 'uuid-ossp' }
      ],
      roles: []
    };
    
    // Generate migration
    const generator = new MigrationGenerator();
    const migration = generator.generateMigration(schema, {
      schemaName: TEST_SCHEMA,
      includeExtensions: true,
      includeEnums: false,
      includeTables: false
    });
    
    expect(migration).toBeDefined();
    expect(migration.steps.length).toBe(3);
    
    // Save migration file
    await saveMigrationFile(migration.version, migration);
    
    // Run migration
    const result = await runner.runMigrations();
    expect(result.success).toBe(true);
    
    // Verify all extensions are installed
    const pgTrgmInstalled = await isExtensionInstalled('pg_trgm');
    const hstoreInstalled = await isExtensionInstalled('hstore');
    const uuidOsspInstalled = await isExtensionInstalled('uuid-ossp');
    
    expect(pgTrgmInstalled).toBe(true);
    expect(hstoreInstalled).toBe(true);
    expect(uuidOsspInstalled).toBe(true);
    
    // Test rollback
    const rollbackResult = await runner.rollback();
    expect(rollbackResult.success).toBe(true);
    
    // Verify all extensions are removed
    const pgTrgmRemovedAfterRollback = await isExtensionInstalled('pg_trgm');
    const hstoreRemovedAfterRollback = await isExtensionInstalled('hstore');
    const uuidOsspRemovedAfterRollback = await isExtensionInstalled('uuid-ossp');
    
    expect(pgTrgmRemovedAfterRollback).toBe(false);
    expect(hstoreRemovedAfterRollback).toBe(false);
    expect(uuidOsspRemovedAfterRollback).toBe(false);
  }, 30000);
  
  // Test deleting an extension after it's been added
  test('should add and then remove an extension', async () => {
    // First add the extension
    const initialSchema: Schema = {
      models: [],
      enums: [],
      extensions: [{ name: 'pg_trgm' }],
      roles: []
    };
    
    // Generate initial migration
    const generator = new MigrationGenerator();
    const addMigration = generator.generateMigration(initialSchema, {
      schemaName: TEST_SCHEMA,
      includeExtensions: true,
      includeEnums: false,
      includeTables: false
    });
    
    // Save migration file
    await saveMigrationFile(addMigration.version, addMigration);
    
    // Run add migration
    const addResult = await runner.runMigrations();
    expect(addResult.success).toBe(true);
    
    // Verify extension is installed
    const isInstalled = await isExtensionInstalled('pg_trgm');
    expect(isInstalled).toBe(true);
    
    // Now create another migration to remove the extension
    // In a real scenario, this would involve comparing fromSchema with toSchema
    // For test purposes, we'll create a drop migration manually
    const dropMigrationVersion = `${parseInt(addMigration.version) + 1}`;
    const dropMigration: Migration = {
      version: dropMigrationVersion,
      description: 'Remove pg_trgm extension',
      timestamp: new Date().toISOString(),
      steps: [{
        type: 'drop',
        objectType: 'extension',
        name: 'pg_trgm',
        sql: 'DROP EXTENSION IF EXISTS "pg_trgm";',
        rollbackSql: 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";'
      }]
    };
    
    // Save drop migration file
    await saveMigrationFile(dropMigration.version, dropMigration);
    
    // Run drop migration
    const dropResult = await runner.runMigrations();
    expect(dropResult.success).toBe(true);
    
    // Verify extension is removed
    const isRemovedAfterDrop = await isExtensionInstalled('pg_trgm');
    expect(isRemovedAfterDrop).toBe(false);
    
    // Test rollback of the drop (should add the extension back)
    const rollbackResult = await runner.rollback();
    expect(rollbackResult.success).toBe(true);
    
    // Verify extension is installed again
    const isInstalledAfterRollback = await isExtensionInstalled('pg_trgm');
    expect(isInstalledAfterRollback).toBe(true);
    
    // Rollback both migrations to clean up
    await runner.rollback(); // Rollback first migration
    
    // Verify everything is cleaned up
    const isRemovedAfterFullRollback = await isExtensionInstalled('pg_trgm');
    expect(isRemovedAfterFullRollback).toBe(false);
  }, 60000);
}); 