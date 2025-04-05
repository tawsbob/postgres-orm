import { Model, Index } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface defining index diff result
 */
export interface IndexDiff {
  added: {
    model: Model;
    index: Index;
  }[];
  removed: {
    model: Model;
    index: Index;
  }[];
  updated: {
    model: Model;
    index: Index;
    previousIndex: Index;
  }[];
}

/**
 * Class responsible for orchestrating index changes between schema versions
 */
export class IndexOrchestrator {
  /**
   * Compare indexes between two schemas and identify differences
   * 
   * @param fromModels Source models
   * @param toModels Target models
   * @returns Object containing added, removed, and updated indexes
   */
  compareIndexes(fromModels: Model[], toModels: Model[]): IndexDiff {
    const added: { model: Model; index: Index }[] = [];
    const removed: { model: Model; index: Index }[] = [];
    const updated: { model: Model; index: Index; previousIndex: Index }[] = [];

    // Map fromModels by name for easier lookup
    const fromModelsMap = new Map<string, Model>();
    fromModels.forEach(model => fromModelsMap.set(model.name, model));

    // Process each model in the target schema
    toModels.forEach(toModel => {
      const fromModel = fromModelsMap.get(toModel.name);
      
      // Skip if model doesn't exist in source or doesn't have indexes
      if (!fromModel) {
        // If the model is new, all its indexes are added
        if (toModel.indexes && toModel.indexes.length > 0) {
          toModel.indexes.forEach(index => {
            added.push({ model: toModel, index });
          });
        }
        return;
      }

      // Create indexes maps for easier comparison
      const fromIndexesMap = this.createIndexesMap(fromModel);
      const toIndexesMap = this.createIndexesMap(toModel);

      // Find added indexes
      if (toModel.indexes) {
        toModel.indexes.forEach(index => {
          const indexKey = this.getIndexKey(index);
          if (!fromIndexesMap.has(indexKey)) {
            added.push({ model: toModel, index });
          } else {
            // Check if the index has been updated
            const fromIndex = fromIndexesMap.get(indexKey);
            if (fromIndex && this.hasIndexChanged(fromIndex, index)) {
              updated.push({ 
                model: toModel, 
                index, 
                previousIndex: fromIndex 
              });
            }
          }
        });
      }

      // Find removed indexes
      if (fromModel.indexes) {
        fromModel.indexes.forEach(index => {
          const indexKey = this.getIndexKey(index);
          if (!toIndexesMap.has(indexKey)) {
            removed.push({ model: fromModel, index });
          }
        });
      }
    });

    // Handle removed models and their indexes
    fromModels.forEach(fromModel => {
      if (!toModels.some(m => m.name === fromModel.name) && fromModel.indexes) {
        // If the model is removed, all its indexes are removed
        fromModel.indexes.forEach(index => {
          removed.push({ model: fromModel, index });
        });
      }
    });

    return { added, removed, updated };
  }

  /**
   * Generate migration steps based on index differences
   * 
   * @param diff The differences between source and target schemas
   * @param schemaName Schema name
   * @returns Array of migration steps for indexes
   */
  generateIndexMigrationSteps(diff: IndexDiff, schemaName: string = 'public'): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Generate steps for added indexes
    diff.added.forEach(({ model, index }) => {
      const indexName = index.name || this.generateIndexName(model.name, index);
      
      steps.push({
        type: 'create',
        objectType: 'index',
        name: indexName,
        sql: SQLGenerator.generateCreateIndexFromIndexTypeSQL(model, index, schemaName),
        rollbackSql: SQLGenerator.generateDropIndexFromIndexTypeSQL(model, index, schemaName)
      });
    });

    // Generate steps for updated indexes
    diff.updated.forEach(({ model, index, previousIndex }) => {
      const indexName = index.name || this.generateIndexName(model.name, index);
      const previousIndexName = previousIndex.name || this.generateIndexName(model.name, previousIndex);
      
      // Drop the old index
      steps.push({
        type: 'drop',
        objectType: 'index',
        name: previousIndexName,
        sql: SQLGenerator.generateDropIndexFromIndexTypeSQL(model, previousIndex, schemaName),
        rollbackSql: SQLGenerator.generateCreateIndexFromIndexTypeSQL(model, previousIndex, schemaName)
      });
      
      // Create the new index
      steps.push({
        type: 'create',
        objectType: 'index',
        name: indexName,
        sql: SQLGenerator.generateCreateIndexFromIndexTypeSQL(model, index, schemaName),
        rollbackSql: SQLGenerator.generateDropIndexFromIndexTypeSQL(model, index, schemaName)
      });
    });

    // Generate steps for removed indexes
    diff.removed.forEach(({ model, index }) => {
      const indexName = index.name || this.generateIndexName(model.name, index);
      
      steps.push({
        type: 'drop',
        objectType: 'index',
        name: indexName,
        sql: SQLGenerator.generateDropIndexFromIndexTypeSQL(model, index, schemaName),
        rollbackSql: SQLGenerator.generateCreateIndexFromIndexTypeSQL(model, index, schemaName)
      });
    });

    return steps;
  }

  /**
   * Create a map of indexes for easier comparison
   * 
   * @param model Model to extract indexes from
   * @returns Map with index keys (field names) as keys and indexes as values
   */
  private createIndexesMap(model: Model): Map<string, Index> {
    const indexesMap = new Map<string, Index>();
    
    if (model.indexes) {
      model.indexes.forEach(index => {
        const key = this.getIndexKey(index);
        indexesMap.set(key, index);
      });
    }
    
    return indexesMap;
  }

  /**
   * Generate a unique key for an index based on its fields
   * 
   * @param index Index to generate key for
   * @returns String key representing the index
   */
  private getIndexKey(index: Index): string {
    // If the index has a name, use it as the key
    if (index.name) {
      return index.name;
    }
    
    // Otherwise, use the sorted fields as the key
    // This ensures that indexes with the same fields in different orders are considered the same
    const sortedFields = [...index.fields].sort();
    return sortedFields.join('_');
  }

  /**
   * Generate a default name for an index
   * 
   * @param tableName Table name
   * @param index Index definition
   * @returns Generated index name
   */
  public generateIndexName(tableName: string, index: Index): string {
    // Use original field order for index naming to maintain consistent naming
    const fieldsPart = index.fields.join('_');
    const typePart = index.type ? `_${index.type.toLowerCase()}` : '';
    const uniquePart = index.unique ? '_unique' : '';
    const wherePart = index.where ? '_filtered' : '';
    
    return `idx_${tableName}_${fieldsPart}${typePart}${uniquePart}${wherePart}`;
  }

  /**
   * Check if an index has changed
   * 
   * @param fromIndex Source index
   * @param toIndex Target index
   * @returns Whether the index has changed
   */
  private hasIndexChanged(fromIndex: Index, toIndex: Index): boolean {
    // Compare uniqueness
    if (fromIndex.unique !== toIndex.unique) return true;
    
    // Compare type
    if (fromIndex.type !== toIndex.type) return true;
    
    // Compare where clause
    if (fromIndex.where !== toIndex.where) return true;
    
    // If we're comparing by name only, fields don't matter
    if (fromIndex.name && toIndex.name && fromIndex.name === toIndex.name) {
      return false;
    }
    
    // Compare fields
    if (fromIndex.fields.length !== toIndex.fields.length) return true;
    
    // Sort fields for comparison to ignore order differences
    const sortedFromFields = [...fromIndex.fields].sort();
    const sortedToFields = [...toIndex.fields].sort();
    
    // Compare each field
    for (let i = 0; i < sortedFromFields.length; i++) {
      if (sortedFromFields[i] !== sortedToFields[i]) return true;
    }
    
    // If we reach here, the indexes are the same
    return false;
  }
} 