import { SchemaParser } from '../../parser/schemaParser';
import { MigrationGenerator } from '../migrationGenerator';
import { MigrationWriter } from '../migrationWriter';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

interface TableRow {
  table_name: string;
}

interface EnumRow {
  enum_name: string;
}

interface ExtensionRow {
  extname: string;
}

async function waitForDatabase(client: Client, maxRetries = 10, retryDelay = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.query('SELECT 1');
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

describe('Migration Integration Tests', () => {
  let client: Client;
  let parser: SchemaParser;
  let generator: MigrationGenerator;
  let writer: MigrationWriter;
  let testMigrationsDir: string;

  beforeAll(async () => {
    // Connect to PostgreSQL
    client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'postgres_orm',
      user: 'postgres',
      password: 'postgres'
    });
    await client.connect();
    await waitForDatabase(client);

    // Initialize components
    parser = new SchemaParser();
    generator = new MigrationGenerator();
    testMigrationsDir = path.join(__dirname, 'test-migrations');
    writer = new MigrationWriter(testMigrationsDir);
  });

  afterAll(async () => {
    try {
      // Clean up database
      await client.query('DROP SCHEMA IF EXISTS public CASCADE');
      await client.query('CREATE SCHEMA public');
    } catch (error) {
      console.error('Error cleaning up database:', error);
    } finally {
      await client.end();
    }

    // Clean up test migrations directory
    if (fs.existsSync(testMigrationsDir)) {
      fs.rmSync(testMigrationsDir, { recursive: true, force: true });
    }
  });

  test('should successfully apply and rollback migrations', async () => {
    // Generate migration
    const schema = parser.parseSchema('schema/database.schema');
    const migration = generator.generateMigration(schema);
    const filePath = writer.writeMigration(migration);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract up and down migrations
    const [upMigration, downMigration] = content.split('-- Down Migration');

    try {
      // Apply up migration
      await client.query('BEGIN');
      await client.query(upMigration);

      // Verify tables were created
      const tablesResult = await client.query<TableRow>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const tables = tablesResult.rows.map(row => row.table_name);
      expect(tables).toContain('User');
      expect(tables).toContain('Profile');
      expect(tables).toContain('Order');
      expect(tables).toContain('Product');
      expect(tables).toContain('ProductOrder');

      // Verify enums were created
      const enumsResult = await client.query<EnumRow>(`
        SELECT t.typname as enum_name
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        GROUP BY t.typname
      `);
      const enums = enumsResult.rows.map(row => row.enum_name);
      expect(enums).toContain('UserRole');
      expect(enums).toContain('OrderStatus');

      // Verify extensions were created
      const extensionsResult = await client.query<ExtensionRow>(`
        SELECT extname 
        FROM pg_extension
      `);

      
      const extensions = extensionsResult.rows.map(row => row.extname);
      expect(extensions).toContain('pgcrypto');
      expect(extensions).toContain('postgis');
      expect(extensions).toContain('uuid-ossp');

      // Apply down migration
      await client.query(downMigration);
      await client.query('COMMIT');

      // Verify tables were dropped
      const tablesAfterRollback = await client.query<TableRow>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      expect(tablesAfterRollback.rows.length).toBe(0);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error during migration test:', error);
      throw error;
    }
  });

  test('should handle custom schema migrations', async () => {
    const customSchema = 'test_schema';
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${customSchema}`);

    try {
      // Generate migration with custom schema
      const schema = parser.parseSchema('schema/database.schema');
      const migration = generator.generateMigration(schema, { schemaName: customSchema });
      const filePath = writer.writeMigration(migration);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Apply migration
      await client.query(content.split('-- Down Migration')[0]);

      // Verify tables were created in custom schema
      const tablesResult = await client.query<TableRow>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
      `, [customSchema]);

      const tables = tablesResult.rows.map(row => row.table_name);
      expect(tables).toContain('User');
      expect(tables).toContain('Profile');
      expect(tables).toContain('Order');
      expect(tables).toContain('Product');
      expect(tables).toContain('ProductOrder');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Clean up custom schema
      await client.query(`DROP SCHEMA IF EXISTS ${customSchema} CASCADE`);
    }
  });
}); 