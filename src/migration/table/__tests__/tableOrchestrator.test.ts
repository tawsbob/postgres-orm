import { TableOrchestrator, TableDiff } from '../tableOrchestrator';
import { Field, Model, FieldType, FieldAttribute } from '../../../parser/types';

describe('TableOrchestrator', () => {
  let orchestrator: TableOrchestrator;

  beforeEach(() => {
    orchestrator = new TableOrchestrator();
  });

  describe('compareTables', () => {
    it('should detect added tables', () => {
      // Arrange
      const fromTables: Model[] = [
        createTestModel('User')
      ];
      
      const toTables: Model[] = [
        createTestModel('User'),
        createTestModel('Product')
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].name).toBe('Product');
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('should detect removed tables', () => {
      // Arrange
      const fromTables: Model[] = [
        createTestModel('User'),
        createTestModel('Product')
      ];
      
      const toTables: Model[] = [
        createTestModel('User')
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].name).toBe('Product');
      expect(result.updated.length).toBe(0);
    });

    it('should detect added fields', () => {
      // Arrange
      const fromTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('email', 'VARCHAR', ['unique'])
        ])
      ];
      
      const toTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('email', 'VARCHAR', ['unique']),
          createField('name', 'VARCHAR', [])
        ])
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].fieldsAdded.length).toBe(1);
      expect(result.updated[0].fieldsAdded[0].name).toBe('name');
      expect(result.updated[0].fieldsRemoved.length).toBe(0);
      expect(result.updated[0].fieldsUpdated.length).toBe(0);
    });

    it('should detect removed fields', () => {
      // Arrange
      const fromTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('email', 'VARCHAR', ['unique']),
          createField('name', 'VARCHAR', [])
        ])
      ];
      
      const toTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('email', 'VARCHAR', ['unique'])
        ])
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].fieldsAdded.length).toBe(0);
      expect(result.updated[0].fieldsRemoved.length).toBe(1);
      expect(result.updated[0].fieldsRemoved[0].name).toBe('name');
      expect(result.updated[0].fieldsUpdated.length).toBe(0);
    });

    it('should detect updated fields', () => {
      // Arrange
      const fromTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('email', 'VARCHAR', ['unique']),
          createField('name', 'VARCHAR', [])
        ])
      ];
      
      const toTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('email', 'VARCHAR', ['unique']),
          createField('name', 'VARCHAR', ['default'], 'John Doe')
        ])
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].fieldsAdded.length).toBe(0);
      expect(result.updated[0].fieldsRemoved.length).toBe(0);
      expect(result.updated[0].fieldsUpdated.length).toBe(1);
      expect(result.updated[0].fieldsUpdated[0].field.name).toBe('name');
      expect(result.updated[0].fieldsUpdated[0].field.defaultValue).toBe('John Doe');
    });

    it('should detect field type changes', () => {
      // Arrange
      const fromTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('age', 'INTEGER', [])
        ])
      ];
      
      const toTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id']),
          createField('age', 'SMALLINT', [])
        ])
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].fieldsUpdated.length).toBe(1);
      expect(result.updated[0].fieldsUpdated[0].field.name).toBe('age');
      expect(result.updated[0].fieldsUpdated[0].field.type).toBe('SMALLINT');
      expect(result.updated[0].fieldsUpdated[0].previousField.type).toBe('INTEGER');
    });

    it('should detect relation changes', () => {
      // Arrange
      const fromTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id'])
        ], [
          {
            name: 'posts',
            type: 'one-to-many',
            model: 'Post',
            fields: undefined,
            references: undefined
          }
        ])
      ];
      
      const toTables: Model[] = [
        createTestModel('User', [
          createField('id', 'UUID', ['id'])
        ], [
          {
            name: 'posts',
            type: 'one-to-many',
            model: 'Article', // Changed relation model
            fields: undefined,
            references: undefined
          }
        ])
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].relationsChanged).toBe(true);
    });

    it('should detect row level security changes', () => {
      // Arrange
      const fromTables: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: false
          }
        }
      ];
      
      const toTables: Model[] = [
        {
          ...createTestModel('User'),
          rowLevelSecurity: {
            enabled: true,
            force: true // Changed force setting
          }
        }
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].rlsChanged).toBe(true);
    });

    it('should detect policy changes', () => {
      // Arrange
      const fromTables: Model[] = [
        {
          ...createTestModel('User'),
          policies: [
            {
              name: 'user_policy',
              for: ['select'],
              to: 'authenticated',
              using: 'true'
            }
          ]
        }
      ];
      
      const toTables: Model[] = [
        {
          ...createTestModel('User'),
          policies: [
            {
              name: 'user_policy',
              for: ['select', 'update'], // Changed permissions
              to: 'authenticated',
              using: 'true'
            }
          ]
        }
      ];

      // Act
      const result = orchestrator.compareTables(fromTables, toTables);

      // Assert
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].policiesChanged).toBe(true);
    });
  });

  describe('generateTableMigrationSteps', () => {
    it('should generate steps for added tables', () => {
      // Arrange
      const diff: TableDiff = {
        added: [createTestModel('Product')],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generateTableMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('table');
      expect(steps[0].name).toBe('Product');
    });

    it('should generate steps for removed tables', () => {
      // Arrange
      const diff: TableDiff = {
        added: [],
        removed: [createTestModel('Product')],
        updated: []
      };

      // Act
      const steps = orchestrator.generateTableMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('table');
      expect(steps[0].name).toBe('Product');
    });

    it('should generate steps for added fields', () => {
      // Arrange
      const model = createTestModel('User');
      const newField = createField('name', 'VARCHAR', []);
      
      const diff: TableDiff = {
        added: [],
        removed: [],
        updated: [{
          model,
          previousModel: model,
          fieldsAdded: [newField],
          fieldsRemoved: [],
          fieldsUpdated: [],
          relationsChanged: false,
          rlsChanged: false,
          policiesChanged: false
        }]
      };

      // Act
      const steps = orchestrator.generateTableMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('alter');
      expect(steps[0].objectType).toBe('table');
      expect(steps[0].name).toBe('User_add_name');
    });

    it('should generate steps for removed fields', () => {
      // Arrange
      const model = createTestModel('User');
      const removedField = createField('name', 'VARCHAR', []);
      
      const diff: TableDiff = {
        added: [],
        removed: [],
        updated: [{
          model,
          previousModel: model,
          fieldsAdded: [],
          fieldsRemoved: [removedField],
          fieldsUpdated: [],
          relationsChanged: false,
          rlsChanged: false,
          policiesChanged: false
        }]
      };

      // Act
      const steps = orchestrator.generateTableMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('alter');
      expect(steps[0].objectType).toBe('table');
      expect(steps[0].name).toBe('User_drop_name');
    });

    it('should generate steps for updated fields', () => {
      // Arrange
      const model = createTestModel('User');
      const oldField = createField('name', 'VARCHAR', []);
      const newField = createField('name', 'VARCHAR', ['default'], 'John Doe');
      
      const diff: TableDiff = {
        added: [],
        removed: [],
        updated: [{
          model,
          previousModel: model,
          fieldsAdded: [],
          fieldsRemoved: [],
          fieldsUpdated: [{
            field: newField,
            previousField: oldField
          }],
          relationsChanged: false,
          rlsChanged: false,
          policiesChanged: false
        }]
      };

      // Act
      const steps = orchestrator.generateTableMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('alter');
      expect(steps[0].objectType).toBe('table');
      expect(steps[0].name).toBe('User_alter_name');
    });
  });

  describe('Nullable Field Detection', () => {
    it('should detect when a field changes from nullable to non-nullable', () => {
      // Create models with the same structure but different nullability
      const fromModel: Model = {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute, 'default' as FieldAttribute],
            defaultValue: 'gen_random_uuid()',
            nullable: false
          },
          {
            name: 'name',
            type: 'VARCHAR' as FieldType,
            attributes: [],
            length: 150,
            nullable: true
          }
        ],
        relations: []
      };

      const toModel: Model = {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute, 'default' as FieldAttribute],
            defaultValue: 'gen_random_uuid()',
            nullable: false
          },
          {
            name: 'name',
            type: 'VARCHAR' as FieldType,
            attributes: [],
            length: 150,
            nullable: false // Changed from true to false
          }
        ],
        relations: []
      };

      const diff = orchestrator.compareTables([fromModel], [toModel]);
      
      // Should find the changed model
      expect(diff.updated).toHaveLength(1);
      
      // Should have the correct updated fields
      const fieldUpdates = diff.updated[0].fieldsUpdated;
      expect(fieldUpdates).toHaveLength(1);
      
      // Should identify the name field as updated
      const nameFieldUpdate = fieldUpdates.find(update => update.field.name === 'name');
      expect(nameFieldUpdate).toBeDefined();
      expect(nameFieldUpdate?.previousField.nullable).toBe(true);
      expect(nameFieldUpdate?.field.nullable).toBe(false);
    });

    it('should detect when a field changes from non-nullable to nullable', () => {
      // Create models with the same structure but different nullability
      const fromModel: Model = {
        name: 'Product',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute],
            nullable: false
          },
          {
            name: 'description',
            type: 'TEXT' as FieldType,
            attributes: [],
            nullable: false
          }
        ],
        relations: []
      };

      const toModel: Model = {
        name: 'Product',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute],
            nullable: false
          },
          {
            name: 'description',
            type: 'TEXT' as FieldType,
            attributes: [],
            nullable: true // Changed from false to true
          }
        ],
        relations: []
      };

      const diff = orchestrator.compareTables([fromModel], [toModel]);
      
      // Should find the changed model
      expect(diff.updated).toHaveLength(1);
      
      // Should have the correct updated fields
      const fieldUpdates = diff.updated[0].fieldsUpdated;
      expect(fieldUpdates).toHaveLength(1);
      
      // Should identify the description field as updated
      const descriptionFieldUpdate = fieldUpdates.find(update => update.field.name === 'description');
      expect(descriptionFieldUpdate).toBeDefined();
      expect(descriptionFieldUpdate?.previousField.nullable).toBe(false);
      expect(descriptionFieldUpdate?.field.nullable).toBe(true);
    });

    it('should not detect changes when nullability remains the same', () => {
      // Create models with the same structure and nullability
      const fromModel: Model = {
        name: 'Order',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute],
            nullable: false
          },
          {
            name: 'notes',
            type: 'TEXT' as FieldType,
            attributes: [],
            nullable: true
          }
        ],
        relations: []
      };

      const toModel: Model = {
        name: 'Order',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute],
            nullable: false
          },
          {
            name: 'notes',
            type: 'TEXT' as FieldType,
            attributes: [],
            nullable: true // Same as from model
          }
        ],
        relations: []
      };

      const diff = orchestrator.compareTables([fromModel], [toModel]);
      
      // Should not find any updated models
      expect(diff.updated).toHaveLength(0);
    });

    it('should detect multiple nullable field changes in the same model', () => {
      // Create models with multiple nullable changes
      const fromModel: Model = {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute],
            nullable: false
          },
          {
            name: 'name',
            type: 'VARCHAR' as FieldType,
            attributes: [],
            length: 150,
            nullable: true
          },
          {
            name: 'email',
            type: 'VARCHAR' as FieldType,
            attributes: ['unique' as FieldAttribute],
            length: 255,
            nullable: false
          },
          {
            name: 'phoneNumber',
            type: 'VARCHAR' as FieldType,
            attributes: [],
            length: 20,
            nullable: true
          }
        ],
        relations: []
      };

      const toModel: Model = {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'UUID' as FieldType,
            attributes: ['id' as FieldAttribute],
            nullable: false
          },
          {
            name: 'name',
            type: 'VARCHAR' as FieldType,
            attributes: [],
            length: 150,
            nullable: false // Changed from true to false
          },
          {
            name: 'email',
            type: 'VARCHAR' as FieldType,
            attributes: ['unique' as FieldAttribute],
            length: 255,
            nullable: true // Changed from false to true
          },
          {
            name: 'phoneNumber',
            type: 'VARCHAR' as FieldType,
            attributes: [],
            length: 20,
            nullable: true // No change
          }
        ],
        relations: []
      };

      const diff = orchestrator.compareTables([fromModel], [toModel]);
      
      // Should find the changed model
      expect(diff.updated).toHaveLength(1);
      
      // Should have the correct updated fields
      const fieldUpdates = diff.updated[0].fieldsUpdated;
      expect(fieldUpdates).toHaveLength(2);
      
      // Should identify the name field as updated
      const nameFieldUpdate = fieldUpdates.find(update => update.field.name === 'name');
      expect(nameFieldUpdate).toBeDefined();
      expect(nameFieldUpdate?.previousField.nullable).toBe(true);
      expect(nameFieldUpdate?.field.nullable).toBe(false);
      
      // Should identify the email field as updated
      const emailFieldUpdate = fieldUpdates.find(update => update.field.name === 'email');
      expect(emailFieldUpdate).toBeDefined();
      expect(emailFieldUpdate?.previousField.nullable).toBe(false);
      expect(emailFieldUpdate?.field.nullable).toBe(true);
    });
  });
});

// Helper functions for test data creation
function createTestModel(
  name: string, 
  fields: Field[] = [createField('id', 'UUID', ['id'])],
  relations: Model['relations'] = []
): Model {
  return {
    name,
    fields,
    relations
  };
}

function createField(
  name: string, 
  type: string, 
  attributes: string[] = [],
  defaultValue?: string,
  length?: number,
  precision?: number,
  scale?: number
): Field {
  return {
    name,
    type: type as any, // Cast to any to avoid type errors in tests
    attributes: attributes as any, // Cast to any to avoid type errors in tests
    defaultValue,
    length,
    precision,
    scale
  };
} 