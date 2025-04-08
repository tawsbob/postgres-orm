import SchemaParserV1 from '../../parser/schemaParser';
import { MigrationGenerator } from '../../migration/migrationGenerator';

describe('Relation Modification Migration Tests', () => {
  let migrationGenerator: MigrationGenerator;
  let schemaParser: SchemaParserV1;

  beforeEach(() => {
    migrationGenerator = new MigrationGenerator();
    schemaParser = new SchemaParserV1();
  });

  test('should generate migration for modifying relation onDelete behavior', () => {
    // Original schema
    const originalRawSchema = `
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

    // Modified schema with onDelete added
    const modifiedRawSchema = `
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

    // Parse both schemas
    const originalSchema = schemaParser.parseSchema(undefined, originalRawSchema);
    const modifiedSchema = schemaParser.parseSchema(undefined, modifiedRawSchema);

    // Generate the migration from original to modified
    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, modifiedSchema);

    // Verify that the migration contains steps for altering the relation
    const alterSteps = migration.steps.filter(step => 
      step.type === 'alter' || step.type === 'drop' && step.objectType === 'constraint');
    
    expect(alterSteps.length).toBeGreaterThan(0);
    
    // Check for the creation of the new constraint with CASCADE
    const createStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint' && 
      step.sql.includes('ON DELETE CASCADE'));
    
    expect(createStep).toBeDefined();
    expect(createStep?.sql).toContain('FOREIGN KEY');
    expect(createStep?.sql).toContain('REFERENCES');
  });

  test('should generate migration for modifying relation onUpdate behavior', () => {
    // Original schema
    const originalRawSchema = `
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

    // Modified schema with onUpdate added
    const modifiedRawSchema = `
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

    // Parse both schemas
    const originalSchema = schemaParser.parseSchema(undefined, originalRawSchema);
    const modifiedSchema = schemaParser.parseSchema(undefined, modifiedRawSchema);

    // Generate the migration from original to modified
    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, modifiedSchema);

    // Check for the creation of the new constraint with CASCADE
    const createStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint' && 
      step.sql.includes('ON UPDATE CASCADE'));
    
    expect(createStep).toBeDefined();
    expect(createStep?.sql).toContain('FOREIGN KEY');
    expect(createStep?.sql).toContain('REFERENCES');
  });
  
  test('should generate migration for changing the referenced field in a relation', () => {
    // Original schema with email as primary key
    const originalRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        posts         Post[]
      }

      model Post {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        title         VARCHAR(255)
        content       TEXT
        user          User            @relation(fields: [userId], references: [id])
      }
    `;

    // Modified schema with reference changed to email
    const modifiedRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        posts         Post[]          @relation("UserPosts")
      }

      model Post {
        id            UUID            @id @default(gen_random_uuid())
        userEmail     VARCHAR(255)
        title         VARCHAR(255)
        content       TEXT
        user          User            @relation("UserPosts", fields: [userEmail], references: [email])
      }
    `;

    // Parse both schemas
    const originalSchema = schemaParser.parseSchema(undefined, originalRawSchema);
    const modifiedSchema = schemaParser.parseSchema(undefined, modifiedRawSchema);

    // Generate the migration from original to modified
    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, modifiedSchema);

    // Check for steps that drop the old column and constraint
    const dropSteps = migration.steps.filter(step => step.type === 'drop');
    expect(dropSteps.length).toBeGreaterThan(0);
    
    // Check for steps that add the new column and constraint
    const addColumnStep = migration.steps.find(step => 
      step.type === 'alter' && step.objectType === 'table' && 
      step.sql.includes('ADD COLUMN "userEmail"'));
    expect(addColumnStep).toBeDefined();
    
    // Check for the new foreign key constraint
    const addConstraintStep = migration.steps.find(step => 
      step.type === 'create' && step.objectType === 'constraint' && 
      step.sql.includes('FOREIGN KEY ("userEmail")') && 
      step.sql.includes('REFERENCES') && 
      step.sql.includes('"email"'));
    expect(addConstraintStep).toBeDefined();
  });

  test('should generate migration for removing a relation', () => {
    // Original schema with relation
    const originalRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
        posts         Post[]
      }

      model Post {
        id            UUID            @id @default(gen_random_uuid())
        userId        UUID
        title         VARCHAR(255)
        content       TEXT
        user          User            @relation(fields: [userId], references: [id])
      }
    `;

    // Modified schema with relation removed
    const modifiedRawSchema = `
      // PostgreSQL Schema Definition
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(150)
      }

      model Post {
        id            UUID            @id @default(gen_random_uuid())
        title         VARCHAR(255)
        content       TEXT
      }
    `;

    // Parse both schemas
    const originalSchema = schemaParser.parseSchema(undefined, originalRawSchema);
    const modifiedSchema = schemaParser.parseSchema(undefined, modifiedRawSchema);

    // Generate the migration from original to modified
    const migration = migrationGenerator.generateMigrationFromDiff(originalSchema, modifiedSchema);

    // Check that the migration has steps
    expect(migration.steps.length).toBeGreaterThan(0);
    
    // Find steps that modify the Post table
    const postTableSteps = migration.steps.filter(step => 
      step.name === 'Post' || (step.sql && step.sql.includes('Post')));
    
    // Verify there are steps that modify the Post table
    expect(postTableSteps.length).toBeGreaterThan(0);
    
    // Check for steps related to constraint/relation removal
    const constraintSteps = migration.steps.filter(step => 
      step.type === 'drop' && 
      step.objectType === 'constraint' || 
      (step.sql && step.sql.includes('CONSTRAINT')));
    
    // Verify there are constraint-related steps
    expect(constraintSteps.length).toBeGreaterThan(0);
    
    // Look for any operation that would remove a column or reference
    const columnOperations = migration.steps.filter(step => 
      (step.sql && step.sql.includes('DROP COLUMN')) || 
      (step.sql && step.sql.includes('userId')));
    
    // Verify there are operations affecting columns
    expect(columnOperations.length).toBeGreaterThan(0);
  });
}); 