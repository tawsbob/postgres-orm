import { Model, RowLevelSecurity } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface defining RLS diff result
 */
export interface RLSDiff {
  added: {
    model: Model;
  }[];
  removed: {
    model: Model;
  }[];
  updated: {
    model: Model;
    previousSettings: RowLevelSecurity;
  }[];
}

/**
 * Class responsible for orchestrating row level security changes between schema versions
 */
export class RLSOrchestrator {
  /**
   * Compare RLS settings between two schema versions
   * 
   * @param fromModels Source models
   * @param toModels Target models
   * @returns Object containing added, removed, and updated RLS settings
   */
  compareRLS(fromModels: Model[], toModels: Model[]): RLSDiff {
    const added: { model: Model }[] = [];
    const removed: { model: Model }[] = [];
    const updated: { model: Model; previousSettings: RowLevelSecurity }[] = [];

    // Map fromModels by name for easier lookup
    const fromModelsMap = new Map<string, Model>();
    fromModels.forEach(model => fromModelsMap.set(model.name, model));

    // Map toModels by name for easier lookup
    const toModelsMap = new Map<string, Model>();
    toModels.forEach(model => toModelsMap.set(model.name, model));

    // Check for added and updated RLS settings
    toModels.forEach(toModel => {
      const fromModel = fromModelsMap.get(toModel.name);
      
      // If the model exists in both schemas
      if (fromModel) {
        // Check if RLS settings have changed
        if (this.hasRLSChanged(fromModel.rowLevelSecurity, toModel.rowLevelSecurity)) {
          // If the model previously had no RLS and now it does
          if (!fromModel.rowLevelSecurity && toModel.rowLevelSecurity) {
            added.push({ model: toModel });
          } 
          // If the model previously had RLS and now it doesn't
          else if (fromModel.rowLevelSecurity && !toModel.rowLevelSecurity) {
            removed.push({ model: fromModel });
          } 
          // If the model had RLS before and still does, but settings changed
          else if (fromModel.rowLevelSecurity && toModel.rowLevelSecurity) {
            updated.push({ 
              model: toModel, 
              previousSettings: fromModel.rowLevelSecurity 
            });
          }
        }
      } 
      // If the model only exists in the target schema and has RLS
      else if (toModel.rowLevelSecurity) {
        added.push({ model: toModel });
      }
    });

    // Check for removed RLS settings (model exists in source but not in target)
    fromModels.forEach(fromModel => {
      if (!toModelsMap.has(fromModel.name) && fromModel.rowLevelSecurity) {
        removed.push({ model: fromModel });
      }
    });

    return { added, removed, updated };
  }

  /**
   * Check if RLS settings have changed
   * 
   * @param fromRLS Source RLS
   * @param toRLS Target RLS
   * @returns Whether the RLS has changed
   */
  private hasRLSChanged(fromRLS?: RowLevelSecurity, toRLS?: RowLevelSecurity): boolean {
    // If both are undefined, no change
    if (!fromRLS && !toRLS) return false;

    // If one is undefined and the other isn't, it's changed
    if (!fromRLS || !toRLS) return true;

    // Compare enabled and force settings
    return fromRLS.enabled !== toRLS.enabled || fromRLS.force !== toRLS.force;
  }

  /**
   * Generate migration steps based on RLS differences
   * 
   * @param diff The differences between source and target schemas
   * @param schemaName The schema name
   * @returns Array of migration steps for RLS
   */
  generateRLSMigrationSteps(diff: RLSDiff, schemaName: string = 'public'): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Generate steps for added RLS
    diff.added.forEach(({ model }) => {
      const rlsSql = SQLGenerator.generateRLSSQL(model, schemaName);
      rlsSql.forEach((sql, index) => {
        steps.push({
          type: 'create',
          objectType: 'rls',
          name: `rls_${model.name}_${index}`,
          sql,
          rollbackSql: SQLGenerator.generateDisableRLSSQL(model, schemaName)
        });
      });
    });

    // Generate steps for removed RLS
    diff.removed.forEach(({ model }) => {
      steps.push({
        type: 'drop',
        objectType: 'rls',
        name: `rls_${model.name}_disable`,
        sql: SQLGenerator.generateDisableRLSSQL(model, schemaName),
        rollbackSql: SQLGenerator.generateEnableRLSSQL(model, schemaName)
      });

      // If force was enabled, we need to remove that as well
      if (model.rowLevelSecurity?.force) {
        steps.push({
          type: 'drop',
          objectType: 'rls',
          name: `rls_${model.name}_no_force`,
          sql: SQLGenerator.generateNoForceRLSSQL(model, schemaName),
          rollbackSql: SQLGenerator.generateForceRLSSQL(model, schemaName)
        });
      }
    });

    // Generate steps for updated RLS
    diff.updated.forEach(({ model, previousSettings }) => {
      // Handle enabled/disabled changes
      if (previousSettings.enabled !== model.rowLevelSecurity!.enabled) {
        if (model.rowLevelSecurity!.enabled) {
          steps.push({
            type: 'alter',
            objectType: 'rls',
            name: `rls_${model.name}_enable`,
            sql: SQLGenerator.generateEnableRLSSQL(model, schemaName),
            rollbackSql: SQLGenerator.generateDisableRLSSQL(model, schemaName)
          });
        } else {
          steps.push({
            type: 'alter',
            objectType: 'rls',
            name: `rls_${model.name}_disable`,
            sql: SQLGenerator.generateDisableRLSSQL(model, schemaName),
            rollbackSql: SQLGenerator.generateEnableRLSSQL(model, schemaName)
          });
        }
      }

      // Handle force/no force changes
      if (previousSettings.force !== model.rowLevelSecurity!.force) {
        if (model.rowLevelSecurity!.force) {
          steps.push({
            type: 'alter',
            objectType: 'rls',
            name: `rls_${model.name}_force`,
            sql: SQLGenerator.generateForceRLSSQL(model, schemaName),
            rollbackSql: SQLGenerator.generateNoForceRLSSQL(model, schemaName)
          });
        } else {
          steps.push({
            type: 'alter',
            objectType: 'rls',
            name: `rls_${model.name}_no_force`,
            sql: SQLGenerator.generateNoForceRLSSQL(model, schemaName),
            rollbackSql: SQLGenerator.generateForceRLSSQL(model, schemaName)
          });
        }
      }
    });

    return steps;
  }
} 