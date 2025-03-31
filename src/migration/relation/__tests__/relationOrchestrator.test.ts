import { Model, Relation } from '../../../parser/types';
import { RelationOrchestrator } from '../relationOrchestrator';

describe('RelationOrchestrator', () => {
  let orchestrator: RelationOrchestrator;

  beforeEach(() => {
    orchestrator = new RelationOrchestrator();
  });

  // Helper function to create a test model
  const createTestModel = (name: string, relations: Relation[] = []): Model => ({
    name,
    fields: [],
    relations
  });

  // Helper function to create a test relation
  const createTestRelation = (
    name: string,
    type: 'one-to-one' | 'one-to-many' | 'many-to-many',
    targetModel: string,
    fields?: string[],
    references?: string[]
  ): Relation => ({
    name,
    type,
    model: targetModel,
    fields,
    references
  });

  describe('compareRelations', () => {
    it('should detect added relations', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
        ])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].model.name).toBe('User');
      expect(result.added[0].relation.name).toBe('posts');
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('should detect removed relations', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
        ])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].model.name).toBe('User');
      expect(result.removed[0].relation.name).toBe('posts');
      expect(result.updated.length).toBe(0);
    });

    it('should detect updated relation type', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
        ])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'many-to-many', 'Post', ['id'], ['userId'])
        ])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].relation.name).toBe('posts');
      expect(result.updated[0].relation.type).toBe('many-to-many');
      expect(result.updated[0].previousRelation.type).toBe('one-to-many');
    });

    it('should detect updated target model', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
        ])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Article', ['id'], ['userId'])
        ])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].relation.name).toBe('posts');
      expect(result.updated[0].relation.model).toBe('Article');
      expect(result.updated[0].previousRelation.model).toBe('Post');
    });

    it('should detect updated fields', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
        ])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['userId'], ['id'])
        ])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].relation.name).toBe('posts');
      expect(result.updated[0].relation.fields).toEqual(['userId']);
      expect(result.updated[0].previousRelation.fields).toEqual(['id']);
    });

    it('should detect updated references', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
        ])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['authorId'])
        ])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.updated[0].model.name).toBe('User');
      expect(result.updated[0].relation.name).toBe('posts');
      expect(result.updated[0].relation.references).toEqual(['authorId']);
      expect(result.updated[0].previousRelation.references).toEqual(['userId']);
    });

    it('should handle relations in new models', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', []),
        createTestModel('Post', [
          createTestRelation('author', 'one-to-one', 'User', ['userId'], ['id'])
        ])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].model.name).toBe('Post');
      expect(result.added[0].relation.name).toBe('author');
      expect(result.removed.length).toBe(0);
      expect(result.updated.length).toBe(0);
    });

    it('should handle relations in removed models', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', []),
        createTestModel('Post', [
          createTestRelation('author', 'one-to-one', 'User', ['userId'], ['id'])
        ])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].model.name).toBe('Post');
      expect(result.removed[0].relation.name).toBe('author');
      expect(result.updated.length).toBe(0);
    });

    it('should handle multiple relation changes', () => {
      // Arrange
      const fromModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId']),
          createTestRelation('comments', 'one-to-many', 'Comment', ['id'], ['userId'])
        ]),
        createTestModel('Post', [
          createTestRelation('author', 'one-to-one', 'User', ['userId'], ['id'])
        ])
      ];
      
      const toModels: Model[] = [
        createTestModel('User', [
          createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['authorId']), // Updated
          createTestRelation('profile', 'one-to-one', 'Profile', ['id'], ['userId']) // Added
        ]),
        createTestModel('Post', [
          createTestRelation('author', 'one-to-one', 'User', ['authorId'], ['id']) // Updated
        ])
      ];

      // Act
      const result = orchestrator.compareRelations(fromModels, toModels);

      // Assert
      expect(result.added.length).toBe(1);
      expect(result.added[0].relation.name).toBe('profile');
      
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].relation.name).toBe('comments');
      
      expect(result.updated.length).toBe(2);
      expect(result.updated.some(u => u.relation.name === 'posts')).toBe(true);
      expect(result.updated.some(u => u.relation.name === 'author')).toBe(true);
    });
  });

  describe('generateRelationMigrationSteps', () => {
    it('should generate steps for added relations', () => {
      // Arrange
      const diff = {
        added: [
          {
            model: createTestModel('User'),
            relation: createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
          }
        ],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generateRelationMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('create');
      expect(steps[0].objectType).toBe('constraint');
      expect(steps[0].name).toBe('User_posts_fkey');
      expect(steps[0].sql).toBeDefined();
      expect(steps[0].rollbackSql).toBeDefined();
    });

    it('should generate steps for removed relations', () => {
      // Arrange
      const diff = {
        added: [],
        removed: [
          {
            model: createTestModel('User'),
            relation: createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
          }
        ],
        updated: []
      };

      // Act
      const steps = orchestrator.generateRelationMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(1);
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('constraint');
      expect(steps[0].name).toBe('User_posts_fkey');
      expect(steps[0].sql).toBeDefined();
      expect(steps[0].rollbackSql).toBeDefined();
    });

    it('should generate steps for updated relations', () => {
      // Arrange
      const diff = {
        added: [],
        removed: [],
        updated: [
          {
            model: createTestModel('User'),
            relation: createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['authorId']),
            previousRelation: createTestRelation('posts', 'one-to-many', 'Post', ['id'], ['userId'])
          }
        ]
      };

      // Act
      const steps = orchestrator.generateRelationMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(2); // Drop old constraint + create new one
      expect(steps[0].type).toBe('drop');
      expect(steps[0].objectType).toBe('constraint');
      expect(steps[0].name).toBe('User_posts_fkey');
      expect(steps[1].type).toBe('create');
      expect(steps[1].objectType).toBe('constraint');
      expect(steps[1].name).toBe('User_posts_fkey');
    });

    it('should handle relations without fields or references', () => {
      // Arrange
      const diff = {
        added: [
          {
            model: createTestModel('User'),
            relation: createTestRelation('posts', 'one-to-many', 'Post') // No fields or references
          }
        ],
        removed: [],
        updated: []
      };

      // Act
      const steps = orchestrator.generateRelationMigrationSteps(diff);

      // Assert
      expect(steps.length).toBe(0); // No steps should be generated
    });
  });
}); 