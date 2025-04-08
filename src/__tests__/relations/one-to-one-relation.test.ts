import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('One-to-One Relation Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for one-to-one relation between User and Profile', () => {
    // Create a raw schema with a one-to-one relation
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        profile       Profile?        @relation("UserProfile")
      }

      model Profile {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID            @unique
        bio           TEXT
        user          User            @relation("UserProfile", fields: [userId], references: [id])
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Check that the migration contains the right steps
    expect(migration.steps.length).toBe(5); // 2 tables + 1 foreign key constraint + 2 other steps

    // Find the table creation steps
    const userTableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'User');
    const profileTableStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'Profile');
    
    // Verify user table creation
    expect(userTableStep).toBeDefined();
    expect(userTableStep?.sql).toContain('CREATE TABLE');
    expect(userTableStep?.sql).toContain('"id" UUID PRIMARY KEY');
    expect(userTableStep?.sql).toContain('"email" VARCHAR(255)');
    expect(userTableStep?.sql).toContain('"name" VARCHAR(150)');
    
    // Verify profile table creation
    expect(profileTableStep).toBeDefined();
    expect(profileTableStep?.sql).toContain('CREATE TABLE');
    expect(profileTableStep?.sql).toContain('"id" UUID PRIMARY KEY');
    expect(profileTableStep?.sql).toContain('"userId" UUID');
    expect(profileTableStep?.sql).toContain('"bio" TEXT');
    
    // Find the foreign key constraint step
    const fkStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint');
    
    // Verify foreign key constraint
    expect(fkStep).toBeDefined();
    expect(fkStep?.sql).toContain('ALTER TABLE');
    expect(fkStep?.sql).toContain('ADD CONSTRAINT');
    expect(fkStep?.sql).toContain('FOREIGN KEY ("userId")');
    expect(fkStep?.sql).toContain('REFERENCES');
    expect(fkStep?.sql).toContain('"User"');
  });

  test('should generate migration for one-to-one relation with specified onDelete action', () => {
    // Create a raw schema with a one-to-one relation and onDelete action
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        profile       Profile?        @relation("UserProfile")
      }

      model Profile {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID            @unique
        bio           TEXT
        user          User            @relation("UserProfile", fields: [userId], references: [id], onDelete: "CASCADE")
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the foreign key constraint step
    const fkStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint');
    
    // Verify foreign key constraint with onDelete
    expect(fkStep).toBeDefined();
    expect(fkStep?.sql).toContain('ALTER TABLE');
    expect(fkStep?.sql).toContain('ADD CONSTRAINT');
    expect(fkStep?.sql).toContain('FOREIGN KEY ("userId")');
    expect(fkStep?.sql).toContain('ON DELETE CASCADE');
  });

  test('should generate migration for one-to-one relation with specified onUpdate action', () => {
    // Create a raw schema with a one-to-one relation and onUpdate action
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        profile       Profile?        @relation("UserProfile")
      }

      model Profile {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID            @unique
        bio           TEXT
        user          User            @relation("UserProfile", fields: [userId], references: [id], onUpdate: "CASCADE")
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the foreign key constraint step
    const fkStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint');
    
    // Verify foreign key constraint with onUpdate
    expect(fkStep).toBeDefined();
    expect(fkStep?.sql).toContain('ALTER TABLE');
    expect(fkStep?.sql).toContain('ADD CONSTRAINT');
    expect(fkStep?.sql).toContain('FOREIGN KEY ("userId")');
    expect(fkStep?.sql).toContain('ON UPDATE CASCADE');
  });

  test('should generate migration for one-to-one relation with both onDelete and onUpdate actions', () => {
    // Create a raw schema with a one-to-one relation and both actions
    const rawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        profile       Profile?        @relation("UserProfile")
      }

      model Profile {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID            @unique
        bio           TEXT
        user          User            @relation("UserProfile", fields: [userId], references: [id], onDelete: "CASCADE", onUpdate: "SET NULL")
      }
    `;

    // Parse the schema
    const schema = schemaParser.parseSchema(undefined, rawSchema);

    // Generate the migration
    const migration = migrationGenerator.generateMigration(schema, {
      includeExtensions: false,
      includeEnums: false,
      includeTables: true,
      includeRoles: false
    });

    // Find the foreign key constraint step
    const fkStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint');
    
    // Verify foreign key constraint with both onDelete and onUpdate
    expect(fkStep).toBeDefined();
    expect(fkStep?.sql).toContain('ALTER TABLE');
    expect(fkStep?.sql).toContain('ADD CONSTRAINT');
    expect(fkStep?.sql).toContain('FOREIGN KEY ("userId")');
    expect(fkStep?.sql).toContain('ON DELETE CASCADE');
    expect(fkStep?.sql).toContain('ON UPDATE SET NULL');
  });
}); 