import { Model, Relation } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface representing differences between two sets of relations
 */
export interface RelationDiff {
  /**
   * Relations that exist in the target model but not in the source model
   */
  added: {
    model: Model;
    relation: Relation;
  }[];
  
  /**
   * Relations that exist in the source model but not in the target model
   */
  removed: {
    model: Model;
    relation: Relation;
  }[];
  
  /**
   * Relations that exist in both models but have different properties
   */
  updated: {
    model: Model;
    relation: Relation;
    previousRelation: Relation;
  }[];
}

/**
 * Orchestrator for managing PostgreSQL relation changes between schema versions
 */
export class RelationOrchestrator {
  /**
   * Compare relations between two sets of models and identify differences
   * 
   * @param fromModels Source schema models
   * @param toModels Target schema models
   * @returns Differences between the two sets of relations
   */
  compareRelations(fromModels: Model[], toModels: Model[]): RelationDiff {
    const diff: RelationDiff = {
      added: [],
      removed: [],
      updated: []
    };

    // Create maps for models by name for easier lookup
    const fromModelsMap = new Map<string, Model>();
    fromModels.forEach(model => fromModelsMap.set(model.name, model));
    
    const toModelsMap = new Map<string, Model>();
    toModels.forEach(model => toModelsMap.set(model.name, model));
    
    // Check each target model against source model
    toModels.forEach(toModel => {
      const fromModel = fromModelsMap.get(toModel.name);
      
      if (fromModel) {
        // Create relation maps for easier comparison
        const fromRelationsMap = new Map<string, Relation>();
        fromModel.relations.forEach(relation => {
          fromRelationsMap.set(relation.name, relation);
        });
        
        const toRelationsMap = new Map<string, Relation>();
        toModel.relations.forEach(relation => {
          toRelationsMap.set(relation.name, relation);
        });
        
        // Find added relations
        toModel.relations.forEach(toRelation => {
          if (!fromRelationsMap.has(toRelation.name)) {
            diff.added.push({
              model: toModel,
              relation: toRelation
            });
          }
        });
        
        // Find removed relations
        fromModel.relations.forEach(fromRelation => {
          if (!toRelationsMap.has(fromRelation.name)) {
            diff.removed.push({
              model: fromModel,
              relation: fromRelation
            });
          }
        });
        
        // Find updated relations
        toModel.relations.forEach(toRelation => {
          const fromRelation = fromRelationsMap.get(toRelation.name);
          if (fromRelation && this.hasRelationChanged(fromRelation, toRelation)) {
            diff.updated.push({
              model: toModel,
              relation: toRelation,
              previousRelation: fromRelation
            });
          }
        });
      } else {
        // If the model is new, all its relations are new
        toModel.relations.forEach(relation => {
          diff.added.push({
            model: toModel,
            relation
          });
        });
      }
    });
    
    // Find relations from removed models
    fromModels.forEach(fromModel => {
      if (!toModelsMap.has(fromModel.name)) {
        // If the model is removed, all its relations are removed
        fromModel.relations.forEach(relation => {
          diff.removed.push({
            model: fromModel,
            relation
          });
        });
      }
    });
    
    return diff;
  }
  
  /**
   * Check if a relation has changed
   * 
   * @param fromRelation Source relation
   * @param toRelation Target relation
   * @returns Whether the relation has changed
   */
  private hasRelationChanged(fromRelation: Relation, toRelation: Relation): boolean {
    // Compare relation properties
    if (
      fromRelation.type !== toRelation.type ||
      fromRelation.model !== toRelation.model
    ) {
      return true;
    }
    
    // Compare fields array
    if (!this.areArraysEqual(fromRelation.fields, toRelation.fields)) {
      return true;
    }
    
    // Compare references array
    if (!this.areArraysEqual(fromRelation.references, toRelation.references)) {
      return true;
    }
    
    // Compare onDelete and onUpdate actions
    if (fromRelation.onDelete !== toRelation.onDelete) {
      return true;
    }
    
    if (fromRelation.onUpdate !== toRelation.onUpdate) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Helper method to compare possibly undefined arrays
   */
  private areArraysEqual(arr1?: string[], arr2?: string[]): boolean {
    // Both undefined or null
    if (!arr1 && !arr2) return true;
    
    // One defined, one undefined
    if (!arr1 || !arr2) return false;
    
    // Both defined but different lengths
    if (arr1.length !== arr2.length) return false;
    
    // Both defined, same length, compare contents
    return arr1.every((item, index) => item === arr2[index]);
  }
  
  /**
   * Generate migration steps for relation changes
   * 
   * @param diff Relation differences
   * @param schemaName Schema name
   * @returns Array of migration steps
   */
  generateRelationMigrationSteps(diff: RelationDiff, schemaName: string = 'public'): MigrationStep[] {
    const steps: MigrationStep[] = [];
    
    // Handle added relations - create foreign keys
    diff.added.forEach(({ model, relation }) => {
      if (relation.fields && relation.references) {
        const sql = SQLGenerator.generateCreateForeignKeySQL(model, relation, schemaName);
        const rollbackSql = SQLGenerator.generateDropForeignKeySQL(model, relation, schemaName);
        
        steps.push({
          type: 'create',
          objectType: 'constraint',
          name: `${model.name}_${relation.name}_fkey`,
          sql,
          rollbackSql
        });
      }
    });
    
    // Handle removed relations - drop foreign keys
    diff.removed.forEach(({ model, relation }) => {
      if (relation.fields && relation.references) {
        const sql = SQLGenerator.generateDropForeignKeySQL(model, relation, schemaName);
        const rollbackSql = SQLGenerator.generateCreateForeignKeySQL(model, relation, schemaName);
        
        steps.push({
          type: 'drop',
          objectType: 'constraint',
          name: `${model.name}_${relation.name}_fkey`,
          sql,
          rollbackSql
        });
      }
    });
    
    // Handle updated relations - drop old foreign key and create new one
    diff.updated.forEach(({ model, relation, previousRelation }) => {
      if (previousRelation.fields && previousRelation.references) {
        const dropSql = SQLGenerator.generateDropForeignKeySQL(model, previousRelation, schemaName);
        steps.push({
          type: 'drop',
          objectType: 'constraint',
          name: `${model.name}_${relation.name}_fkey`,
          sql: dropSql,
          rollbackSql: SQLGenerator.generateCreateForeignKeySQL(model, previousRelation, schemaName)
        });
      }
      
      if (relation.fields && relation.references) {
        const createSql = SQLGenerator.generateCreateForeignKeySQL(model, relation, schemaName);
        steps.push({
          type: 'create',
          objectType: 'constraint',
          name: `${model.name}_${relation.name}_fkey`,
          sql: createSql,
          rollbackSql: SQLGenerator.generateDropForeignKeySQL(model, relation, schemaName)
        });
      }
    });
    
    return steps;
  }
} 