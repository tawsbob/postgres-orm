import { Schema } from '../../../parser/types';
import { MigrationGenerator } from '../../migrationGenerator';

describe('IndexOrchestrator Integration', () => {
  let generator: MigrationGenerator;

  beforeEach(() => {
    generator = new MigrationGenerator();
  });

  test('should generate migration for added index', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'email', type: 'VARCHAR', attributes: [] }
          ],
          relations: []
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    const toSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'email', type: 'VARCHAR', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['name', 'email'] }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    expect(indexSteps).toHaveLength(1);
    expect(indexSteps[0].type).toBe('create');
    expect(indexSteps[0].name).toContain('idx_User_');
    expect(indexSteps[0].sql).toContain('CREATE INDEX');
    expect(indexSteps[0].sql).toContain('"name", "email"');
  });

  test('should generate migration for removed index', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'email', type: 'VARCHAR', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['name', 'email'] }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    const toSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'email', type: 'VARCHAR', attributes: [] }
          ],
          relations: []
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    expect(indexSteps).toHaveLength(1);
    expect(indexSteps[0].type).toBe('drop');
    expect(indexSteps[0].name).toContain('idx_User_');
    expect(indexSteps[0].sql).toContain('DROP INDEX');
  });

  test('should generate migration for updated index (unique)', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'email', type: 'VARCHAR', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['email'] }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    const toSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'email', type: 'VARCHAR', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['email'], unique: true }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    expect(indexSteps).toHaveLength(2); // One to drop, one to create
    
    // Check drop step
    expect(indexSteps[0].type).toBe('drop');
    expect(indexSteps[0].sql).toContain('DROP INDEX');
    
    // Check create step
    expect(indexSteps[1].type).toBe('create');
    expect(indexSteps[1].sql).toContain('CREATE UNIQUE INDEX');
  });

  test('should generate migration for updated index (where clause)', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'active', type: 'BOOLEAN', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['name'] }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    const toSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'active', type: 'BOOLEAN', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['name'], where: 'active = true' }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    expect(indexSteps).toHaveLength(2); // One to drop, one to create
    
    // Check drop step
    expect(indexSteps[0].type).toBe('drop');
    expect(indexSteps[0].sql).toContain('DROP INDEX');
    
    // Check create step
    expect(indexSteps[1].type).toBe('create');
    expect(indexSteps[1].sql).toContain('WHERE active = true');
  });

  test('should handle multiple index operations in a single migration', () => {
    // Arrange
    const fromSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'email', type: 'VARCHAR', attributes: [] },
            { name: 'active', type: 'BOOLEAN', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['name'] },
            { fields: ['email'], unique: true }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    const toSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'email', type: 'VARCHAR', attributes: [] },
            { name: 'active', type: 'BOOLEAN', attributes: [] }
          ],
          relations: [],
          indexes: [
            { fields: ['name'], where: 'active = true' },
            { fields: ['name', 'email'] } // New index
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Act
    const migration = generator.generateMigrationFromDiff(fromSchema, toSchema);

    // Assert
    const indexSteps = migration.steps.filter(step => step.objectType === 'index');
    expect(indexSteps).toHaveLength(4); 
    
    // One drop and one create for updated index
    expect(indexSteps[0].type).toBe('drop');
    expect(indexSteps[1].type).toBe('create');
    
    // One create for added index
    expect(indexSteps[2].type).toBe('create');
    
    // One drop for removed index
    expect(indexSteps[3].type).toBe('drop');
  });
}); 