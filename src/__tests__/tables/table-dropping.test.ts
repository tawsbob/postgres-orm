import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';
import { Schema } from '../../parser/types';

describe('Table Dropping Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for dropping a single table', () => {
    // Original schema with a table
    const oldRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        email VARCHAR(255) @unique
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with the table removed
    const newRawSchema = `
      // PostgreSQL Schema Definition
    `;
    const newSchema = schemaParser.parseSchema(undefined, newRawSchema);

    // Generate the migration by comparing schemas
    const migration = migrationGenerator.generateMigrationFromDiff(oldSchema, newSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Check that the migration contains the right step
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('User');
    expect(migration.steps[0].sql).toContain('DROP TABLE');
    
    // Check rollback SQL - should create the table
    expect(migration.steps[0].rollbackSql).toContain('CREATE TABLE');
    expect(migration.steps[0].rollbackSql).toContain('"id" UUID');
    expect(migration.steps[0].rollbackSql).toContain('"name" VARCHAR');
    expect(migration.steps[0].rollbackSql).toContain('"email" VARCHAR');
  });

  test('should generate migration for dropping multiple tables', () => {
    // Original schema with multiple tables
    const oldRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
      }

      model Product {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        price DECIMAL(10,2)
      }

      model Order {
        id UUID @id @default(gen_random_uuid())
        orderDate TIMESTAMP @default(now())
        total DECIMAL(10,2)
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with all tables removed
    const newRawSchema = `
      // PostgreSQL Schema Definition
    `;
    const newSchema = schemaParser.parseSchema(undefined, newRawSchema);

    // Generate the migration by comparing schemas
    const migration = migrationGenerator.generateMigrationFromDiff(oldSchema, newSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(3);
    
    // Check for each table
    const tableNames = migration.steps.map(step => step.name);
    expect(tableNames).toContain('User');
    expect(tableNames).toContain('Product');
    expect(tableNames).toContain('Order');
    
    // Verify all steps are drop operations
    expect(migration.steps.every(step => step.type === 'drop')).toBe(true);
    expect(migration.steps.every(step => step.objectType === 'table')).toBe(true);
    
    // Verify SQL for each table drop
    migration.steps.forEach(step => {
      expect(step.sql).toContain('DROP TABLE');
      expect(step.rollbackSql).toContain('CREATE TABLE');
    });
  });

  test('should generate migration for selectively dropping tables', () => {
    // Original schema with multiple tables
    const oldRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
      }

      model Product {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        price DECIMAL(10,2)
      }

      model Order {
        id UUID @id @default(gen_random_uuid())
        orderDate TIMESTAMP @default(now())
        total DECIMAL(10,2)
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with one table removed
    const newRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
      }

      model Product {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        price DECIMAL(10,2)
      }
    `;
    const newSchema = schemaParser.parseSchema(undefined, newRawSchema);

    // Generate the migration by comparing schemas
    const migration = migrationGenerator.generateMigrationFromDiff(oldSchema, newSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Check that the migration contains the right step
    expect(migration.steps.length).toBe(1);
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('table');
    expect(migration.steps[0].name).toBe('Order');
    expect(migration.steps[0].sql).toContain('DROP TABLE');
    expect(migration.steps[0].rollbackSql).toContain('CREATE TABLE');
  });

  test('should handle dropping tables with dependencies properly', () => {
    // Original schema with tables and foreign key relationships
    const oldRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id UUID @id @default(gen_random_uuid())
        name VARCHAR(255)
        // One-to-many relation
        posts Post[]
      }

      model Post {
        id UUID @id @default(gen_random_uuid())
        title VARCHAR(255)
        content TEXT
        // Many-to-one relation to User
        userId UUID
        user User @relation(fields: [userId], references: [id])
      }
    `;
    const oldSchema = schemaParser.parseSchema(undefined, oldRawSchema);

    // Updated schema with both tables removed
    const newRawSchema = `
      // PostgreSQL Schema Definition
    `;
    const newSchema = schemaParser.parseSchema(undefined, newRawSchema);

    // Generate the migration by comparing schemas
    const migration = migrationGenerator.generateMigrationFromDiff(oldSchema, newSchema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRelations: true,
      includeRoles: false
    });

    // All steps should be drop operations
    expect(migration.steps.every(step => step.type === 'drop')).toBe(true);
    
    // Check if the steps are in the correct order (dependent tables should be dropped first)
    // Find the positions of User and Post drops
    const userDropIndex = migration.steps.findIndex(step => 
      step.type === 'drop' && step.objectType === 'table' && step.name === 'User'
    );
    
    const postDropIndex = migration.steps.findIndex(step => 
      step.type === 'drop' && step.objectType === 'table' && step.name === 'Post'
    );
    
    // Either Post should be dropped before User (correct dependency order)
    // or the User drop should use CASCADE
    if (userDropIndex !== -1 && postDropIndex !== -1) {
      if (postDropIndex > userDropIndex) {
        // If order is User then Post, the User drop should use CASCADE
        const userDropSQL = migration.steps[userDropIndex].sql;
        expect(userDropSQL).toContain('CASCADE');
      } else {
        // Otherwise, Post should be dropped before User
        expect(postDropIndex).toBeLessThan(userDropIndex);
      }
    }
  });
}); 