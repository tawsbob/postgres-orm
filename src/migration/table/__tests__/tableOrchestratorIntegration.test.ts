import { Schema } from '../../../parser/types';
import { TableOrchestrator } from '../tableOrchestrator';
import SchemaParserV1 from '../../../parser/schemaParser';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationStep } from '../../types';

describe('TableOrchestrator Integration Tests', () => {
  let orchestrator: TableOrchestrator;
  let parser: SchemaParserV1;

  beforeEach(() => {
    orchestrator = new TableOrchestrator();
    parser = new SchemaParserV1();
  });

  // Helper function to manually parse schema content
  const parseSchemaContent = (content: string): Schema => {
    // Simple mock parsing of schema for testing
    const models: Schema['models'] = [];
    const lines = content.split('\n');
    
    let currentModel: any = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('model')) {
        const modelMatch = trimmedLine.match(/model\s+(\w+)/);
        if (modelMatch) {
          currentModel = {
            name: modelMatch[1],
            fields: [],
            relations: []
          };
          models.push(currentModel);
        }
      } else if (currentModel && trimmedLine.match(/\w+\s+\w+/) && !trimmedLine.startsWith('//')) {
        // Simple field parsing
        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 2) {
          const fieldName = parts[0];
          const fieldType = parts[1];
          
          const field: any = {
            name: fieldName,
            type: fieldType,
            attributes: []
          };
          
          // Check for attributes
          if (trimmedLine.includes('@id')) field.attributes.push('id');
          if (trimmedLine.includes('@unique')) field.attributes.push('unique');
          if (trimmedLine.includes('@default')) {
            field.attributes.push('default');
            const defaultMatch = trimmedLine.match(/@default\(([^)]+)\)/);
            if (defaultMatch) {
              field.defaultValue = defaultMatch[1];
            }
          }
          
          // Check for field length/precision
          const typeWithSize = fieldType.match(/(\w+)\((\d+)(?:,(\d+))?\)/);
          if (typeWithSize) {
            field.type = typeWithSize[1];
            if (typeWithSize[3]) {
              field.precision = parseInt(typeWithSize[2]);
              field.scale = parseInt(typeWithSize[3]);
            } else {
              field.length = parseInt(typeWithSize[2]);
            }
          }
          
          currentModel.fields.push(field);
        }
      }
    }
    
    return {
      models,
      enums: [],
      extensions: [],
      roles: []
    };
  };

  it('should generate proper migration steps between different schema versions', async () => {
    // Original schema with a User model
    const originalSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(100)
      }
    `;

    // Modified schema with a new field and model
    const modifiedSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(100)
        age           INTEGER
      }

      model Product {
        id            UUID            @id @default(gen_random_uuid())
        name          VARCHAR(255)
        price         DECIMAL(10,2)
      }
    `;

    // Parse both schemas
    const fromSchema = parseSchemaContent(originalSchema);
    const toSchema = parseSchemaContent(modifiedSchema);

    // Compare the schemas
    const diff = orchestrator.compareTables(fromSchema.models, toSchema.models);

    // Generate migration steps
    const steps = orchestrator.generateTableMigrationSteps(diff);

    // Validate results
    expect(diff.added.length).toBe(1);
    expect(diff.added[0].name).toBe('Product');
    
    expect(diff.updated.length).toBe(1);
    expect(diff.updated[0].model.name).toBe('User');
    expect(diff.updated[0].fieldsAdded.length).toBe(1);
    expect(diff.updated[0].fieldsAdded[0].name).toBe('age');

    // Validate migration steps
    expect(steps.length).toBe(2);
    
    // Find the create table step
    const createStep = steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'Product'
    );
    expect(createStep).toBeDefined();
    expect(createStep?.sql).toContain('CREATE TABLE');
    expect(createStep?.sql).toContain('Product');
    
    // Find the alter table step
    const alterStep = steps.find(step => 
      step.type === 'alter' && step.objectType === 'table' && step.name === 'User_add_age'
    );
    expect(alterStep).toBeDefined();
    expect(alterStep?.sql).toContain('ALTER TABLE');
    expect(alterStep?.sql).toContain('ADD COLUMN');
    expect(alterStep?.sql).toContain('age');
  });

  it('should handle field type changes correctly', async () => {
    // Original schema
    const originalSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        age           INTEGER
      }
    `;

    // Modified schema with field type change
    const modifiedSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        age           SMALLINT
      }
    `;

    // Parse both schemas
    const fromSchema = parseSchemaContent(originalSchema);
    const toSchema = parseSchemaContent(modifiedSchema);

    // Compare the schemas
    const diff = orchestrator.compareTables(fromSchema.models, toSchema.models);

    // Generate migration steps
    const steps = orchestrator.generateTableMigrationSteps(diff);

    // Validate results
    expect(diff.updated.length).toBe(1);
    expect(diff.updated[0].fieldsUpdated.length).toBe(1);
    expect(diff.updated[0].fieldsUpdated[0].field.type).toBe('SMALLINT');
    expect(diff.updated[0].fieldsUpdated[0].previousField.type).toBe('INTEGER');

    // Validate migration step
    expect(steps.length).toBe(1);
    expect(steps[0].type).toBe('alter');
    expect(steps[0].objectType).toBe('table');
    expect(steps[0].name).toBe('User_alter_age');
    expect(steps[0].sql).toContain('ALTER COLUMN');
    expect(steps[0].sql).toContain('TYPE SMALLINT');
  });

  it('should handle field removal correctly', async () => {
    // Original schema
    const originalSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        age           INTEGER
      }
    `;

    // Modified schema with a field removed
    const modifiedSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
      }
    `;

    // Parse both schemas
    const fromSchema = parseSchemaContent(originalSchema);
    const toSchema = parseSchemaContent(modifiedSchema);

    // Compare the schemas
    const diff = orchestrator.compareTables(fromSchema.models, toSchema.models);

    // Generate migration steps
    const steps = orchestrator.generateTableMigrationSteps(diff);

    // Validate results
    expect(diff.updated.length).toBe(1);
    expect(diff.updated[0].fieldsRemoved.length).toBe(1);
    expect(diff.updated[0].fieldsRemoved[0].name).toBe('age');

    // Validate migration step
    expect(steps.length).toBe(1);
    expect(steps[0].type).toBe('alter');
    expect(steps[0].objectType).toBe('table');
    expect(steps[0].name).toBe('User_drop_age');
    expect(steps[0].sql).toContain('DROP COLUMN');
    expect(steps[0].sql).toContain('age');
  });

  it('should handle complex schema changes in a single migration', async () => {
    // Original complex schema
    const originalSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        name          VARCHAR(100)
      }

      model Post {
        id            UUID            @id @default(gen_random_uuid())
        title         VARCHAR(255)
        body          TEXT
      }
    `;

    // Modified complex schema with multiple changes
    const modifiedSchema = `
      model User {
        id            UUID            @id @default(gen_random_uuid())
        email         VARCHAR(255)    @unique
        fullName      VARCHAR(150)
        age           INTEGER
      }

      model Article {
        id            UUID            @id @default(gen_random_uuid())
        title         VARCHAR(255)
        content       TEXT
        published     BOOLEAN        @default(false)
      }
    `;

    // Parse both schemas
    const fromSchema = parseSchemaContent(originalSchema);
    const toSchema = parseSchemaContent(modifiedSchema);

    // Compare the schemas
    const diff = orchestrator.compareTables(fromSchema.models, toSchema.models);

    // Generate migration steps
    const steps = orchestrator.generateTableMigrationSteps(diff);

    // Validate diff results
    expect(diff.added.length).toBe(1);
    expect(diff.added[0].name).toBe('Article');
    
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].name).toBe('Post');
    
    expect(diff.updated.length).toBe(1);
    expect(diff.updated[0].model.name).toBe('User');
    
    // The User model changes are detected as:
    // - Added 'age' field
    // - Removed 'name' field 
    // - Added 'fullName' field (since our simple diff doesn't detect renames)
    expect(diff.updated[0].fieldsAdded.some(f => f.name === 'age')).toBe(true);
    expect(diff.updated[0].fieldsAdded.some(f => f.name === 'fullName')).toBe(true);
    expect(diff.updated[0].fieldsRemoved.some(f => f.name === 'name')).toBe(true);

    // We should have multiple steps
    expect(steps.length).toBeGreaterThanOrEqual(4);
    
    // Check for User table alteration steps
    const userAlterSteps = steps.filter(step => 
      step.type === 'alter' && step.objectType === 'table' && step.name.startsWith('User_')
    );
    expect(userAlterSteps.length).toBeGreaterThanOrEqual(3);
    
    // Check for Article table creation
    const articleCreateStep = steps.find(step => 
      step.type === 'create' && step.objectType === 'table' && step.name === 'Article'
    );
    expect(articleCreateStep).toBeDefined();
    
    // Check for Post table drop
    const postDropStep = steps.find(step => 
      step.type === 'drop' && step.objectType === 'table' && step.name === 'Post'
    );
    expect(postDropStep).toBeDefined();
  });
}); 