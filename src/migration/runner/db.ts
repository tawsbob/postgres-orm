import { Pool, PoolClient } from 'pg';
import { MigrationRecord } from './types';

export class MigrationDatabase {
  private pool: Pool;
  private migrationsTableName: string;
  private schemaName: string;

  constructor(
    connectionString?: string,
    schemaName = 'public',
    migrationsTableName = 'schema_migrations'
  ) {
    this.pool = new Pool({ connectionString });
    this.migrationsTableName = migrationsTableName;
    this.schemaName = schemaName;
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async initMigrationsTable(): Promise<void> {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS ${this.schemaName};
      
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.${this.migrationsTableName} (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        timestamp VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }

  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.pool.query<MigrationRecord>(`
      SELECT * FROM ${this.schemaName}.${this.migrationsTableName}
      ORDER BY id ASC
    `);
    return result.rows;
  }

  async recordMigration(
    client: PoolClient,
    version: string,
    name: string,
    timestamp: string
  ): Promise<void> {
    await client.query(`
      INSERT INTO ${this.schemaName}.${this.migrationsTableName}
        (version, name, timestamp)
      VALUES
        ($1, $2, $3)
    `, [version, name, timestamp]);
  }

  async removeMigrationRecord(
    client: PoolClient,
    version: string
  ): Promise<void> {
    await client.query(`
      DELETE FROM ${this.schemaName}.${this.migrationsTableName}
      WHERE version = $1
    `, [version]);
  }

  async executeSQL(client: PoolClient, sql: string): Promise<void> {
    if (sql.trim()) {
      await client.query(sql);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
} 