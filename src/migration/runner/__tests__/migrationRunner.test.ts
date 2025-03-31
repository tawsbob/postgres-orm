import { PostgresMigrationRunner } from '../migrationRunner';
import fs from 'fs/promises';
import path from 'path';
import { Migration } from '../../types';
import { Pool } from 'pg';

const TEST_MIGRATIONS_DIR = path.join(__dirname, 'test-migrations');
const DB_CONNECTION_STRING = 'postgresql://postgres:postgres@localhost:5432/postgres_orm';
const TEST_SCHEMA = 'migration_test';

// Helper to create test migration files
const createMigrationFile = async (
  version: string,
  description: string,
  steps: Array<{ 
    sql: string; 
    rollbackSql: string;
    type: 'create' | 'alter' | 'drop';
    objectType: 'table' | 'enum' | 'extension' | 'constraint' | 'index' | 'rls' | 'role' | 'policy';
    name: string;
  }>
): Promise<string> => {
  const migration: Migration = {
    version,
    description,
    steps,
    timestamp: new Date().toISOString()
  };

  const filePath = path.join(TEST_MIGRATIONS_DIR, `${version}_${description.replace(/\s+/g, '_')}.json`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(migration, null, 2));
  return filePath;
};

// Helper to clean up database after tests
const cleanupDatabase = async (): Promise<void> => {
  const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
  try {
    await pool.query(`
      DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE;
      DROP TABLE IF EXISTS public.schema_migrations;
    `);
  } finally {
    await pool.end();
  }
};

describe('PostgresMigrationRunner', () => {
  let runner: PostgresMigrationRunner;

  beforeAll(async () => {
    // Ensure test migrations directory exists
    await fs.mkdir(TEST_MIGRATIONS_DIR, { recursive: true });
  });

  beforeEach(async () => {
    // Clean up test environment
    await cleanupDatabase();
    
    try {
      // Clean up test migrations directory
      const files = await fs.readdir(TEST_MIGRATIONS_DIR);
      await Promise.all(
        files.map(file => fs.unlink(path.join(TEST_MIGRATIONS_DIR, file)))
      );
    } catch (error) {
      // Directory might not exist yet, which is fine
    }

    // Create a new runner for each test
    runner = new PostgresMigrationRunner({
      connectionString: DB_CONNECTION_STRING,
      migrationsDir: TEST_MIGRATIONS_DIR,
      schemaName: TEST_SCHEMA,
      migrationsTableName: 'schema_migrations'
    });
  });

  afterEach(async () => {
    await runner.close();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupDatabase();
    
    try {
      // Remove test migrations directory
      await fs.rm(TEST_MIGRATIONS_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test migrations directory:', error);
    }
  });

  test('should initialize migrations table', async () => {
    await runner.init();
    
    // Verify migration table exists by getting migration status
    const status = await runner.getMigrationsStatus();
    expect(status).toBeDefined();
    expect(status.applied).toEqual([]);
    expect(status.pending).toEqual([]);
  });

  test('should detect pending migrations', async () => {
    // Create test migration files
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);

    await runner.init();
    
    // Check migration status
    const status = await runner.getMigrationsStatus();
    expect(status.applied).toEqual([]);
    expect(status.pending).toHaveLength(1);
    expect(status.pending[0].version).toBe('001');
    expect(status.pending[0].description).toBe('create test table');
  });

  test('should run pending migrations', async () => {
    // Create test migration files
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);

    // Run migrations
    const result = await runner.runMigrations();
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.appliedMigrations).toEqual(['001']);
    
    // Check migration status
    const status = await runner.getMigrationsStatus();
    expect(status.applied).toHaveLength(1);
    expect(status.applied[0].version).toBe('001');
    expect(status.pending).toHaveLength(0);
    
    // Verify table was created
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'test_table'
        );
      `, [TEST_SCHEMA]);
      
      expect(tableResult.rows[0].exists).toBe(true);
    } finally {
      await pool.end();
    }
  });

  test('should run multiple migrations in order', async () => {
    // Create test migration files
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);
    
    await createMigrationFile('002', 'add email column', [
      {
        type: 'alter',
        objectType: 'table',
        name: 'test_table',
        sql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" ADD COLUMN "email" TEXT;`,
        rollbackSql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" DROP COLUMN "email";`
      }
    ]);

    // Run migrations
    const result = await runner.runMigrations();
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.appliedMigrations).toEqual(['001', '002']);
    
    // Verify column was added
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      const columnResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'test_table' AND column_name = 'email'
        );
      `, [TEST_SCHEMA]);
      
      expect(columnResult.rows[0].exists).toBe(true);
    } finally {
      await pool.end();
    }
  });

  test('should run migrations in a transaction that rolls back on error', async () => {
    // Create test migration files
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);
    
    await createMigrationFile('002', 'invalid migration', [
      {
        type: 'alter',
        objectType: 'table',
        name: 'test_table',
        sql: `ALTER TABLE "${TEST_SCHEMA}"."nonexistent_table" ADD COLUMN "value" INTEGER;`, // This will fail
        rollbackSql: `ALTER TABLE "${TEST_SCHEMA}"."nonexistent_table" DROP COLUMN "value";`
      }
    ]);

    // Run migrations
    const result = await runner.runMigrations();
    
    // Verify result
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    // Check migration status - no migrations should be applied due to transaction rollback
    const status = await runner.getMigrationsStatus();
    expect(status.applied).toHaveLength(0);
    expect(status.pending).toHaveLength(2);
    
    // Verify first table was not created due to transaction rollback
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'test_table'
        );
      `, [TEST_SCHEMA]);
      
      expect(tableResult.rows[0].exists).toBe(false);
    } finally {
      await pool.end();
    }
  });

  test('should support dry run mode', async () => {
    // Create test migration files
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);

    // Run migrations in dry run mode
    const result = await runner.runMigrations({ dryRun: true });
    
    // Verify result
    expect(result.success).toBe(true);
    expect(result.appliedMigrations).toEqual(['001']);
    
    // Verify table was not actually created
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'test_table'
        );
      `, [TEST_SCHEMA]);
      
      expect(tableResult.rows[0].exists).toBe(false);
    } finally {
      await pool.end();
    }
  });

  test('should roll back the most recent migration', async () => {
    // Create and apply two migrations
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);
    
    await createMigrationFile('002', 'add email column', [
      {
        type: 'alter',
        objectType: 'table',
        name: 'test_table',
        sql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" ADD COLUMN "email" TEXT;`,
        rollbackSql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" DROP COLUMN "email";`
      }
    ]);

    // Run migrations
    await runner.runMigrations();
    
    // Roll back the most recent migration
    const rollbackResult = await runner.rollback();
    
    // Verify result
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBackMigrations).toEqual(['002']);
    
    // Verify email column was removed
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      const columnResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'test_table' AND column_name = 'email'
        );
      `, [TEST_SCHEMA]);
      
      expect(columnResult.rows[0].exists).toBe(false);
      
      // But table should still exist
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'test_table'
        );
      `, [TEST_SCHEMA]);
      
      expect(tableResult.rows[0].exists).toBe(true);
    } finally {
      await pool.end();
    }
  });

  test('should roll back to a specific version', async () => {
    // Create and apply three migrations
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);
    
    await createMigrationFile('002', 'add email column', [
      {
        type: 'alter',
        objectType: 'table',
        name: 'test_table',
        sql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" ADD COLUMN "email" TEXT;`,
        rollbackSql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" DROP COLUMN "email";`
      }
    ]);
    
    await createMigrationFile('003', 'add phone column', [
      {
        type: 'alter',
        objectType: 'table',
        name: 'test_table',
        sql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" ADD COLUMN "phone" TEXT;`,
        rollbackSql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" DROP COLUMN "phone";`
      }
    ]);

    // Run migrations
    await runner.runMigrations();
    
    // Roll back to version 001
    const rollbackResult = await runner.rollback({ toVersion: '001' });
    
    // Verify result
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBackMigrations).toEqual(['003', '002']);
    
    // Check migration status
    const status = await runner.getMigrationsStatus();
    expect(status.applied).toHaveLength(1);
    expect(status.applied[0].version).toBe('001');
    
    // Verify columns were removed
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      // Email column should be gone
      const emailResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'test_table' AND column_name = 'email'
        );
      `, [TEST_SCHEMA]);
      expect(emailResult.rows[0].exists).toBe(false);
      
      // Phone column should be gone
      const phoneResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'test_table' AND column_name = 'phone'
        );
      `, [TEST_SCHEMA]);
      expect(phoneResult.rows[0].exists).toBe(false);
      
      // But table should still exist
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'test_table'
        );
      `, [TEST_SCHEMA]);
      expect(tableResult.rows[0].exists).toBe(true);
    } finally {
      await pool.end();
    }
  });

  test('should support dry run mode for rollback', async () => {
    // Create and apply two migrations
    await createMigrationFile('001', 'create test table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      }
    ]);
    
    await createMigrationFile('002', 'add email column', [
      {
        type: 'alter',
        objectType: 'table',
        name: 'test_table',
        sql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" ADD COLUMN "email" TEXT;`,
        rollbackSql: `ALTER TABLE "${TEST_SCHEMA}"."test_table" DROP COLUMN "email";`
      }
    ]);

    // Run migrations
    await runner.runMigrations();
    
    // Roll back in dry run mode
    const rollbackResult = await runner.rollback({ dryRun: true });
    
    // Verify result reports 002 would be rolled back
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBackMigrations).toEqual(['002']);
    
    // Verify email column still exists (since it was just a dry run)
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      const columnResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'test_table' AND column_name = 'email'
        );
      `, [TEST_SCHEMA]);
      
      expect(columnResult.rows[0].exists).toBe(true);
    } finally {
      await pool.end();
    }
  });

  test('should handle rollback with multiple steps', async () => {
    // Create and apply migration with multiple steps
    await createMigrationFile('001', 'create test schema and table', [
      {
        type: 'create',
        objectType: 'table',
        name: 'test_table',
        sql: `CREATE TABLE "${TEST_SCHEMA}"."test_table" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );`,
        rollbackSql: `DROP TABLE "${TEST_SCHEMA}"."test_table";`
      },
      {
        type: 'create',
        objectType: 'index',
        name: 'idx_test_table_name',
        sql: `CREATE INDEX "idx_test_table_name" ON "${TEST_SCHEMA}"."test_table" ("name");`,
        rollbackSql: `DROP INDEX "${TEST_SCHEMA}"."idx_test_table_name";`
      }
    ]);

    // Run migrations
    await runner.runMigrations();
    
    // Roll back
    const rollbackResult = await runner.rollback();
    
    // Verify result
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBackMigrations).toEqual(['001']);
    
    // Verify table was dropped
    const pool = new Pool({ connectionString: DB_CONNECTION_STRING });
    try {
      const tableResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'test_table'
        );
      `, [TEST_SCHEMA]);
      
      expect(tableResult.rows[0].exists).toBe(false);
    } finally {
      await pool.end();
    }
  });

  test('should handle empty migrations directory', async () => {
    // Don't create any migration files
    
    await runner.init();
    
    // Check migration status
    const status = await runner.getMigrationsStatus();
    expect(status.applied).toEqual([]);
    expect(status.pending).toEqual([]);
    
    // Run migrations (should succeed with no changes)
    const result = await runner.runMigrations();
    expect(result.success).toBe(true);
    expect(result.appliedMigrations).toEqual([]);
  });

  test('should handle empty rollback with no applied migrations', async () => {
    // Don't create or apply any migrations
    
    await runner.init();
    
    // Try to roll back (should succeed with no changes)
    const rollbackResult = await runner.rollback();
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.rolledBackMigrations).toEqual([]);
  });
});
