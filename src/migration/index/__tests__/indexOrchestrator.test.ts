import { Model, Index } from '../../../parser/types';
import { IndexOrchestrator, IndexDiff } from '../indexOrchestrator';
import { SQLGenerator } from '../../sqlGenerator';

describe('IndexOrchestrator', () => {
  let orchestrator: IndexOrchestrator;

  beforeEach(() => {
    orchestrator = new IndexOrchestrator();
  });

  describe('compareIndexes', () => {
    test('should identify added indexes', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: []
        }
      ];
      const toModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { fields: ['name'] },
            { fields: ['email'], unique: true }
          ]
        }
      ];

      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);

      // Assert
      expect(diff.added).toHaveLength(2);
      expect(diff.added[0].model.name).toBe('User');
      expect(diff.added[0].index.fields).toEqual(['name']);
      expect(diff.added[1].model.name).toBe('User');
      expect(diff.added[1].index.fields).toEqual(['email']);
      expect(diff.added[1].index.unique).toBe(true);
      expect(diff.removed).toHaveLength(0);
      expect(diff.updated).toHaveLength(0);
    });

    test('should identify removed indexes', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { fields: ['name'] },
            { fields: ['email'], unique: true }
          ]
        }
      ];
      const toModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: []
        }
      ];

      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);

      // Assert
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(2);
      expect(diff.removed[0].model.name).toBe('User');
      expect(diff.removed[0].index.fields).toEqual(['name']);
      expect(diff.removed[1].model.name).toBe('User');
      expect(diff.removed[1].index.fields).toEqual(['email']);
      expect(diff.removed[1].index.unique).toBe(true);
      expect(diff.updated).toHaveLength(0);
    });

    test('should identify updated indexes', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { fields: ['name'] },
            { fields: ['email'], unique: false }
          ]
        }
      ];
      const toModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { fields: ['name'], where: "active = true" },
            { fields: ['email'], unique: true }
          ]
        }
      ];

      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);

      // Assert
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.updated).toHaveLength(2);
      expect(diff.updated[0].model.name).toBe('User');
      expect(diff.updated[0].index.fields).toEqual(['name']);
      expect(diff.updated[0].index.where).toBe("active = true");
      expect(diff.updated[0].previousIndex.fields).toEqual(['name']);
      expect(diff.updated[0].previousIndex.where).toBeUndefined();
      expect(diff.updated[1].model.name).toBe('User');
      expect(diff.updated[1].index.fields).toEqual(['email']);
      expect(diff.updated[1].index.unique).toBe(true);
      expect(diff.updated[1].previousIndex.fields).toEqual(['email']);
      expect(diff.updated[1].previousIndex.unique).toBe(false);
    });

    test('should handle indexes with custom names correctly', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { name: 'idx_user_email', fields: ['email'] }
          ]
        }
      ];
      const toModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { name: 'idx_user_email', fields: ['email'], unique: true }
          ]
        }
      ];

      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);

      // Assert
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.updated).toHaveLength(1);
      expect(diff.updated[0].model.name).toBe('User');
      expect(diff.updated[0].index.name).toBe('idx_user_email');
      expect(diff.updated[0].index.unique).toBe(true);
      expect(diff.updated[0].previousIndex.name).toBe('idx_user_email');
      expect(diff.updated[0].previousIndex.unique).toBeUndefined();
    });

    test('should handle indexes with multiple fields correctly', () => {
      // Arrange
      const fromModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { fields: ['first_name', 'last_name'] }
          ]
        }
      ];
      const toModels: Model[] = [
        {
          name: 'User',
          fields: [],
          relations: [],
          indexes: [
            { fields: ['last_name', 'first_name'] } // order changed
          ]
        }
      ];

      // Act
      const diff = orchestrator.compareIndexes(fromModels, toModels);

      // Assert
      expect(diff.updated).toHaveLength(1);
      expect(diff.updated[0].model.name).toBe('User');
      expect(diff.updated[0].index.fields).toEqual(['last_name', 'first_name']);
      expect(diff.updated[0].previousIndex.fields).toEqual(['first_name', 'last_name']);
    });
  });

  describe('generateIndexMigrationSteps', () => {
    test('should generate steps for added indexes', () => {
      // Arrange
      const diff: IndexDiff = {
        added: [
          {
            model: { name: 'User', fields: [], relations: [] },
            index: { fields: ['name'] }
          },
          {
            model: { name: 'User', fields: [], relations: [] },
            index: { fields: ['email'], unique: true }
          }
        ],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generateIndexMigrationSteps(diff);

      // Assert
      expect(steps).toHaveLength(2);
      
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].name).toBe('idx_User_name');
      expect(steps[0].sql).toBe(SQLGenerator.generateCreateIndexFromIndexTypeSQL(diff.added[0].model, diff.added[0].index));
      expect(steps[0].rollbackSql).toBe(SQLGenerator.generateDropIndexFromIndexTypeSQL(diff.added[0].model, diff.added[0].index));
      
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('index');
      expect(steps[1].name).toBe('idx_User_email_unique');
      expect(steps[1].sql).toBe(SQLGenerator.generateCreateIndexFromIndexTypeSQL(diff.added[1].model, diff.added[1].index));
      expect(steps[1].rollbackSql).toBe(SQLGenerator.generateDropIndexFromIndexTypeSQL(diff.added[1].model, diff.added[1].index));
    });

    test('should generate steps for removed indexes', () => {
      // Arrange
      const diff: IndexDiff = {
        added: [],
        removed: [
          {
            model: { name: 'User', fields: [], relations: [] },
            index: { fields: ['name'] }
          }
        ],
        updated: []
      };

      // Act
      const steps = orchestrator.generateIndexMigrationSteps(diff);

      // Assert
      expect(steps).toHaveLength(1);
      
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].name).toBe('idx_User_name');
      expect(steps[0].sql).toBe(SQLGenerator.generateDropIndexFromIndexTypeSQL(diff.removed[0].model, diff.removed[0].index));
      expect(steps[0].rollbackSql).toBe(SQLGenerator.generateCreateIndexFromIndexTypeSQL(diff.removed[0].model, diff.removed[0].index));
    });

    test('should generate steps for updated indexes', () => {
      // Arrange
      const diff: IndexDiff = {
        added: [],
        removed: [],
        updated: [
          {
            model: { name: 'User', fields: [], relations: [] },
            index: { fields: ['email'], unique: true },
            previousIndex: { fields: ['email'] }
          }
        ]
      };

      // Act
      const steps = orchestrator.generateIndexMigrationSteps(diff);

      // Assert
      expect(steps).toHaveLength(2);
      
      // First drop the old index
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('index');
      expect(steps[0].name).toBe('idx_User_email');
      expect(steps[0].sql).toBe(SQLGenerator.generateDropIndexFromIndexTypeSQL(diff.updated[0].model, diff.updated[0].previousIndex));
      expect(steps[0].rollbackSql).toBe(SQLGenerator.generateCreateIndexFromIndexTypeSQL(diff.updated[0].model, diff.updated[0].previousIndex));
      
      // Then create the new index
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('index');
      expect(steps[1].name).toBe('idx_User_email_unique');
      expect(steps[1].sql).toBe(SQLGenerator.generateCreateIndexFromIndexTypeSQL(diff.updated[0].model, diff.updated[0].index));
      expect(steps[1].rollbackSql).toBe(SQLGenerator.generateDropIndexFromIndexTypeSQL(diff.updated[0].model, diff.updated[0].index));
    });
  });
}); 