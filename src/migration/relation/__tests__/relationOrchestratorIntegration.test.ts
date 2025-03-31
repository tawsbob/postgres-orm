import { RelationOrchestrator } from '../relationOrchestrator';
import { Schema } from '../../../parser/types';
import { MigrationStep } from '../../types';

describe('RelationOrchestrator Integration Tests', () => {
  let orchestrator: RelationOrchestrator;

  beforeEach(() => {
    orchestrator = new RelationOrchestrator();
  });

  it('should correctly transform simple schema relation changes into SQL migration steps', () => {
    // Create a source schema with some relations
    const fromSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] }
          ],
          relations: [
            {
              name: 'posts',
              type: 'one-to-many',
              model: 'Post',
              fields: ['id'],
              references: ['userId']
            }
          ]
        },
        {
          name: 'Post',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'title', type: 'VARCHAR', attributes: [] },
            { name: 'userId', type: 'UUID', attributes: [] }
          ],
          relations: [
            {
              name: 'author',
              type: 'one-to-one',
              model: 'User',
              fields: ['userId'],
              references: ['id']
            }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Create a target schema with modified relations
    const toSchema: Schema = {
      models: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] }
          ],
          relations: [
            {
              name: 'posts',
              type: 'one-to-many',
              model: 'Post',
              fields: ['id'],
              references: ['authorId'] // Changed from userId to authorId
            },
            {
              name: 'comments',
              type: 'one-to-many',
              model: 'Comment',
              fields: ['id'],
              references: ['userId']
            }
          ]
        },
        {
          name: 'Post',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'title', type: 'VARCHAR', attributes: [] },
            { name: 'authorId', type: 'UUID', attributes: [] } // Changed from userId to authorId
          ],
          relations: [
            {
              name: 'author',
              type: 'one-to-one',
              model: 'User',
              fields: ['authorId'], // Changed from userId to authorId
              references: ['id']
            }
          ]
        },
        {
          name: 'Comment',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'content', type: 'TEXT', attributes: [] },
            { name: 'userId', type: 'UUID', attributes: [] }
          ],
          relations: [
            {
              name: 'user',
              type: 'one-to-one',
              model: 'User',
              fields: ['userId'],
              references: ['id']
            }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Compare the schemas and get the relations diff
    const diff = orchestrator.compareRelations(fromSchema.models, toSchema.models);

    // Check that we correctly identified changes
    expect(diff.added.length).toBe(2); // User.comments and Comment.user
    expect(diff.removed.length).toBe(0);
    expect(diff.updated.length).toBe(2); // User.posts and Post.author

    // Generate migration steps
    const steps = orchestrator.generateRelationMigrationSteps(diff);
    
    // We should have drop steps for updated relations, and create steps for updated and new relations
    expect(steps.length).toBe(6); // 2 updates (drop + create each) + 2 new creates

    // Verify SQL formatting of some commands
    const dropSteps = steps.filter(s => s.type === 'drop');
    const createSteps = steps.filter(s => s.type === 'create');
    
    expect(dropSteps.length).toBe(2);
    expect(createSteps.length).toBe(4);
    
    // Check SQL content includes constraint names
    dropSteps.forEach(step => {
      expect(step.sql.includes('DROP CONSTRAINT')).toBe(true);
    });
    
    createSteps.forEach(step => {
      expect(step.sql.includes('ADD CONSTRAINT')).toBe(true);
      expect(step.sql.includes('FOREIGN KEY')).toBe(true);
      expect(step.sql.includes('REFERENCES')).toBe(true);
    });
  });

  it('should handle complex scenarios with multiple relation changes', () => {
    // Setup a complex schema with various relation types
    const fromSchema: Schema = {
      models: [
        {
          name: 'Department',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] }
          ],
          relations: []
        },
        {
          name: 'Employee',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'departmentId', type: 'UUID', attributes: [] },
            { name: 'managerId', type: 'UUID', attributes: [] }
          ],
          relations: [
            {
              name: 'department',
              type: 'one-to-one',
              model: 'Department',
              fields: ['departmentId'],
              references: ['id']
            },
            {
              name: 'manager',
              type: 'one-to-one',
              model: 'Employee',
              fields: ['managerId'],
              references: ['id']
            }
          ]
        },
        {
          name: 'Project',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'leadId', type: 'UUID', attributes: [] }
          ],
          relations: [
            {
              name: 'lead',
              type: 'one-to-one',
              model: 'Employee',
              fields: ['leadId'],
              references: ['id']
            }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Modify the schema with various relation changes
    const toSchema: Schema = {
      models: [
        {
          name: 'Department',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'headId', type: 'UUID', attributes: [] }
          ],
          relations: [
            {
              name: 'head',
              type: 'one-to-one',
              model: 'Employee',
              fields: ['headId'],
              references: ['id']
            }
          ]
        },
        {
          name: 'Employee',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'departmentId', type: 'UUID', attributes: [] },
            { name: 'supervisorId', type: 'UUID', attributes: [] } // Changed from managerId
          ],
          relations: [
            {
              name: 'department',
              type: 'one-to-one',
              model: 'Department',
              fields: ['departmentId'],
              references: ['id']
            },
            {
              name: 'supervisor', // Changed from manager
              type: 'one-to-one',
              model: 'Employee',
              fields: ['supervisorId'], // Changed from managerId
              references: ['id']
            },
            {
              name: 'projects',
              type: 'many-to-many',
              model: 'Project',
              fields: undefined,
              references: undefined
            }
          ]
        },
        {
          name: 'Project',
          fields: [
            { name: 'id', type: 'UUID', attributes: ['id'] },
            { name: 'name', type: 'VARCHAR', attributes: [] },
            { name: 'ownerId', type: 'UUID', attributes: [] } // Changed from leadId
          ],
          relations: [
            {
              name: 'owner', // Changed from lead
              type: 'one-to-one',
              model: 'Employee',
              fields: ['ownerId'], // Changed from leadId
              references: ['id']
            },
            {
              name: 'team',
              type: 'many-to-many',
              model: 'Employee',
              fields: undefined,
              references: undefined
            }
          ]
        }
      ],
      enums: [],
      extensions: [],
      roles: []
    };

    // Compare the schemas
    const diff = orchestrator.compareRelations(fromSchema.models, toSchema.models);

    // Verify differences
    expect(diff.added.length).toBe(5); // Department.head, Employee.projects, Project.team, Department.head, etc
    
    // Count relations that should be marked as removed
    expect(diff.removed.length).toBe(2); // Employee.manager (now supervisor), Project.lead (now owner)
    
    // Count relations that should be marked as updated
    expect(diff.updated.length).toBe(0); // We're treating name changes as remove + add

    // Generate migration steps
    const steps = orchestrator.generateRelationMigrationSteps(diff);
    
    // Check SQL for specific constraints
    const createHeadConstraint = steps.find(s => 
      s.type === 'create' && s.name === 'Department_head_fkey'
    );
    expect(createHeadConstraint).toBeDefined();

    const dropManagerConstraint = steps.find(s => 
      s.type === 'drop' && s.name === 'Employee_manager_fkey'
    );
    expect(dropManagerConstraint).toBeDefined();
    
    const dropLeadConstraint = steps.find(s => 
      s.type === 'drop' && s.name === 'Project_lead_fkey'
    );
    expect(dropLeadConstraint).toBeDefined();
  });
}); 