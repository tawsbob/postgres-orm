import { Schema } from '../../parser/types';
import { MigrationGenerator } from '../migrationGenerator';
import { SQLGenerator } from '../sqlGenerator';

describe('MigrationGenerator - Schema Comparison with Extensions', () => {
  let generator: MigrationGenerator;

  beforeEach(() => {
    generator = new MigrationGenerator();
  });

  test('should generate migration when adding extensions', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [],
      enums: [],
      extensions: [],
      roles: []
    };
    
    const toSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' }
      ],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    expect(migration.steps.length).toBe(2);
    expect(migration.steps[0].type).toBe('create');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('pg_trgm');
    expect(migration.steps[0].sql).toBe(SQLGenerator.generateCreateExtensionSQL('pg_trgm'));
    
    expect(migration.steps[1].type).toBe('create');
    expect(migration.steps[1].objectType).toBe('extension');
    expect(migration.steps[1].name).toBe('hstore');
    expect(migration.steps[1].sql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.4'));
  });

  test('should generate migration when removing extensions', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' }
      ],
      roles: []
    };
    
    const toSchema: Schema = {
      models: [],
      enums: [],
      extensions: [],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    expect(migration.steps.length).toBe(2);
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('pg_trgm');
    expect(migration.steps[0].sql).toBe(SQLGenerator.generateDropExtensionSQL('pg_trgm'));
    
    expect(migration.steps[1].type).toBe('drop');
    expect(migration.steps[1].objectType).toBe('extension');
    expect(migration.steps[1].name).toBe('hstore');
    expect(migration.steps[1].sql).toBe(SQLGenerator.generateDropExtensionSQL('hstore'));
  });

  test('should generate migration when updating extension versions', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'hstore', version: '1.4' }
      ],
      roles: []
    };
    
    const toSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'hstore', version: '1.5' }
      ],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    expect(migration.steps.length).toBe(2);
    
    // First step should drop the old extension
    expect(migration.steps[0].type).toBe('drop');
    expect(migration.steps[0].objectType).toBe('extension');
    expect(migration.steps[0].name).toBe('hstore_old');
    expect(migration.steps[0].sql).toBe(SQLGenerator.generateDropExtensionSQL('hstore'));
    
    // Second step should create the extension with the new version
    expect(migration.steps[1].type).toBe('create');
    expect(migration.steps[1].objectType).toBe('extension');
    expect(migration.steps[1].name).toBe('hstore');
    expect(migration.steps[1].sql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.5'));
  });

  test('should generate migration with mixed extension changes', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' },
        { name: 'postgis', version: '2.5' }
      ],
      roles: []
    };
    
    const toSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' }, // unchanged
        { name: 'hstore', version: '1.5' }, // updated version
        { name: 'uuid-ossp' } // added
      ],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    const extensionSteps = migration.steps.filter(step => step.objectType === 'extension');
    expect(extensionSteps.length).toBe(4);
    
    // Check for added extension
    const addedStep = extensionSteps.find(step => step.type === 'create' && step.name === 'uuid-ossp');
    expect(addedStep).toBeDefined();
    expect(addedStep?.sql).toBe(SQLGenerator.generateCreateExtensionSQL('uuid-ossp'));
    
    // Check for removed extension
    const removedStep = extensionSteps.find(step => step.type === 'drop' && step.name === 'postgis');
    expect(removedStep).toBeDefined();
    expect(removedStep?.sql).toBe(SQLGenerator.generateDropExtensionSQL('postgis'));
    
    // Check for updated extension (should have two steps)
    const dropOldStep = extensionSteps.find(step => step.type === 'drop' && step.name === 'hstore_old');
    expect(dropOldStep).toBeDefined();
    expect(dropOldStep?.sql).toBe(SQLGenerator.generateDropExtensionSQL('hstore'));
    
    const createNewStep = extensionSteps.find(step => step.type === 'create' && step.name === 'hstore');
    expect(createNewStep).toBeDefined();
    expect(createNewStep?.sql).toBe(SQLGenerator.generateCreateExtensionSQL('hstore', '1.5'));
  });

  test('should not generate migration steps for unchanged extensions', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' }
      ],
      roles: []
    };
    
    const toSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' }
      ],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    const extensionSteps = migration.steps.filter(step => step.objectType === 'extension');
    expect(extensionSteps.length).toBe(0);
  });

  test('should respect the includeExtensions option', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [],
      enums: [],
      extensions: [],
      roles: []
    };
    
    const toSchema: Schema = {
      models: [],
      enums: [],
      extensions: [
        { name: 'pg_trgm' },
        { name: 'hstore', version: '1.4' }
      ],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema, {
      includeExtensions: false
    });

    // Assert
    expect(migration.steps.length).toBe(0);
  });
}); 