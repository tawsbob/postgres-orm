import { Field, Model } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface defining table diff result
 */
export interface TableDiff {
  added: Model[];
  removed: Model[];
  updated: {
    model: Model;
    previousModel: Model;
    fieldsAdded: Field[];
    fieldsRemoved: Field[];
    fieldsUpdated: {
      field: Field;
      previousField: Field;
    }[];
    relationsChanged: boolean;
    rlsChanged: boolean;
    policiesChanged: boolean;
  }[];
}

/**
 * Class responsible for orchestrating table changes between schema versions
 */
export class TableOrchestrator {
  /**
   * Compare tables between two schemas and identify differences
   * 
   * @param fromTables Source tables
   * @param toTables Target tables
   * @returns Object containing added, removed, and updated tables
   */
  compareTables(fromTables: Model[], toTables: Model[]): TableDiff {
    const added: Model[] = [];
    const removed: Model[] = [];
    const updated: TableDiff['updated'] = [];

    // Map fromTables by name for easier lookup
    const fromTablesMap = new Map<string, Model>();
    fromTables.forEach(table => fromTablesMap.set(table.name, table));

    // Map toTables by name for easier lookup
    const toTablesMap = new Map<string, Model>();
    toTables.forEach(table => toTablesMap.set(table.name, table));

    // Find added tables
    toTables.forEach(table => {
      if (!fromTablesMap.has(table.name)) {
        added.push(table);
      }
    });

    // Find removed tables
    fromTables.forEach(table => {
      if (!toTablesMap.has(table.name)) {
        removed.push(table);
      }
    });

    // Find updated tables
    toTables.forEach(toTable => {
      const fromTable = fromTablesMap.get(toTable.name);
      if (fromTable) {
        // Compare fields, relations, RLS, and policies
        const { fieldsAdded, fieldsRemoved, fieldsUpdated } = this.compareFields(fromTable.fields, toTable.fields);
        const relationsChanged = this.haveRelationsChanged(fromTable.relations, toTable.relations);
        const rlsChanged = this.hasRLSChanged(fromTable.rowLevelSecurity, toTable.rowLevelSecurity);
        const policiesChanged = this.havePoliciesChanged(fromTable.policies, toTable.policies);

        // If any changes detected, add to updated list
        if (
          fieldsAdded.length > 0 ||
          fieldsRemoved.length > 0 ||
          fieldsUpdated.length > 0 ||
          relationsChanged ||
          rlsChanged ||
          policiesChanged
        ) {
          updated.push({
            model: toTable,
            previousModel: fromTable,
            fieldsAdded,
            fieldsRemoved,
            fieldsUpdated,
            relationsChanged,
            rlsChanged,
            policiesChanged
          });
        }
      }
    });

    return { added, removed, updated };
  }

  /**
   * Compare fields between two models and identify differences
   * 
   * @param fromFields Source fields
   * @param toFields Target fields
   * @returns Object containing added, removed, and updated fields
   */
  private compareFields(fromFields: Field[], toFields: Field[]): {
    fieldsAdded: Field[];
    fieldsRemoved: Field[];
    fieldsUpdated: { field: Field; previousField: Field }[];
  } {
    const fieldsAdded: Field[] = [];
    const fieldsRemoved: Field[] = [];
    const fieldsUpdated: { field: Field; previousField: Field }[] = [];

    // Map fromFields by name for easier lookup
    const fromFieldsMap = new Map<string, Field>();
    fromFields.forEach(field => fromFieldsMap.set(field.name, field));

    // Map toFields by name for easier lookup
    const toFieldsMap = new Map<string, Field>();
    toFields.forEach(field => toFieldsMap.set(field.name, field));

    // Find added fields
    toFields.forEach(field => {
      if (!fromFieldsMap.has(field.name)) {
        fieldsAdded.push(field);
      }
    });

    // Find removed fields
    fromFields.forEach(field => {
      if (!toFieldsMap.has(field.name)) {
        fieldsRemoved.push(field);
      }
    });

    // Find updated fields
    toFields.forEach(toField => {
      const fromField = fromFieldsMap.get(toField.name);
      if (fromField && this.hasFieldChanged(fromField, toField)) {
        fieldsUpdated.push({
          field: toField,
          previousField: fromField
        });
      }
    });

    return { fieldsAdded, fieldsRemoved, fieldsUpdated };
  }

  /**
   * Check if a field has changed
   * 
   * @param fromField Source field
   * @param toField Target field
   * @returns Whether the field has changed
   */
  private hasFieldChanged(fromField: Field, toField: Field): boolean {
    // Compare type
    if (fromField.type !== toField.type) return true;

    // Compare attributes
    if (this.haveAttributesChanged(fromField.attributes, toField.attributes)) return true;

    // Compare defaultValue
    if (fromField.defaultValue !== toField.defaultValue) return true;

    // Compare length
    if (fromField.length !== toField.length) return true;

    // Compare precision
    if (fromField.precision !== toField.precision) return true;

    // Compare scale
    if (fromField.scale !== toField.scale) return true;

    return false;
  }

  /**
   * Check if attributes have changed
   * 
   * @param fromAttributes Source attributes
   * @param toAttributes Target attributes
   * @returns Whether the attributes have changed
   */
  private haveAttributesChanged(fromAttributes: string[], toAttributes: string[]): boolean {
    if (fromAttributes.length !== toAttributes.length) return true;

    const fromSet = new Set(fromAttributes);
    for (const attr of toAttributes) {
      if (!fromSet.has(attr)) return true;
    }

    return false;
  }

  /**
   * Check if relations have changed
   * 
   * @param fromRelations Source relations
   * @param toRelations Target relations
   * @returns Whether the relations have changed
   */
  private haveRelationsChanged(fromRelations: Model['relations'], toRelations: Model['relations']): boolean {
    if (fromRelations.length !== toRelations.length) return true;

    // Create a map of relations by name for easier comparison
    const fromRelationsMap = new Map();
    fromRelations.forEach(rel => {
      fromRelationsMap.set(rel.name, rel);
    });

    // Check if any relation is missing or different
    for (const toRel of toRelations) {
      const fromRel = fromRelationsMap.get(toRel.name);
      if (!fromRel) return true; // Relation doesn't exist in fromRelations

      // Compare relation properties
      if (
        fromRel.type !== toRel.type ||
        fromRel.model !== toRel.model ||
        JSON.stringify(fromRel.fields) !== JSON.stringify(toRel.fields) ||
        JSON.stringify(fromRel.references) !== JSON.stringify(toRel.references)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if RLS settings have changed
   * 
   * @param fromRLS Source RLS
   * @param toRLS Target RLS
   * @returns Whether the RLS has changed
   */
  private hasRLSChanged(fromRLS?: Model['rowLevelSecurity'], toRLS?: Model['rowLevelSecurity']): boolean {
    // If both are undefined, no change
    if (!fromRLS && !toRLS) return false;

    // If one is undefined and the other isn't, it's changed
    if (!fromRLS || !toRLS) return true;

    // Compare enabled and force settings
    return fromRLS.enabled !== toRLS.enabled || fromRLS.force !== toRLS.force;
  }

  /**
   * Check if policies have changed
   * 
   * @param fromPolicies Source policies
   * @param toPolicies Target policies
   * @returns Whether the policies have changed
   */
  private havePoliciesChanged(fromPolicies?: Model['policies'], toPolicies?: Model['policies']): boolean {
    // If both are undefined, no change
    if (!fromPolicies && !toPolicies) return false;

    // If one is undefined and the other isn't, it's changed
    if (!fromPolicies || !toPolicies) return true;

    // If lengths don't match, it's changed
    if (fromPolicies.length !== toPolicies.length) return true;

    // Create a map of policies by name for easier comparison
    const fromPoliciesMap = new Map();
    fromPolicies.forEach(policy => {
      fromPoliciesMap.set(policy.name, policy);
    });

    // Check if any policy is missing or different
    for (const toPolicy of toPolicies) {
      const fromPolicy = fromPoliciesMap.get(toPolicy.name);
      if (!fromPolicy) return true; // Policy doesn't exist in fromPolicies

      // Compare policy properties
      if (
        JSON.stringify(fromPolicy.for) !== JSON.stringify(toPolicy.for) ||
        fromPolicy.to !== toPolicy.to ||
        fromPolicy.using !== toPolicy.using
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate migration steps based on table differences
   * 
   * @param diff The differences between source and target schemas
   * @param schemaName The schema name
   * @returns Array of migration steps for tables
   */
  generateTableMigrationSteps(diff: TableDiff, schemaName: string = 'public'): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Generate steps for added tables
    diff.added.forEach(model => {
      steps.push({
        type: 'create',
        objectType: 'table',
        name: model.name,
        sql: SQLGenerator.generateCreateTableSQL(model, schemaName),
        rollbackSql: SQLGenerator.generateDropTableSQL(model, schemaName)
      });
    });

    // Generate steps for removed tables
    diff.removed.forEach(model => {
      steps.push({
        type: 'drop',
        objectType: 'table',
        name: model.name,
        sql: SQLGenerator.generateDropTableSQL(model, schemaName),
        rollbackSql: SQLGenerator.generateCreateTableSQL(model, schemaName)
      });
    });

    // Generate steps for updated tables
    diff.updated.forEach(update => {
      const { 
        model, 
        fieldsAdded, 
        fieldsRemoved, 
        fieldsUpdated,
        relationsChanged,
        rlsChanged,
        policiesChanged
      } = update;

      // Generate steps for added fields
      fieldsAdded.forEach(field => {
        steps.push({
          type: 'alter',
          objectType: 'table',
          name: `${model.name}_add_${field.name}`,
          sql: SQLGenerator.generateAddColumnSQL(model.name, field, schemaName),
          rollbackSql: SQLGenerator.generateDropColumnSQL(model.name, field.name, schemaName)
        });
      });

      // Generate steps for removed fields
      fieldsRemoved.forEach(field => {
        steps.push({
          type: 'alter',
          objectType: 'table',
          name: `${model.name}_drop_${field.name}`,
          sql: SQLGenerator.generateDropColumnSQL(model.name, field.name, schemaName),
          rollbackSql: SQLGenerator.generateAddColumnSQL(model.name, field, schemaName)
        });
      });

      // Generate steps for updated fields
      fieldsUpdated.forEach(({ field, previousField }) => {
        steps.push({
          type: 'alter',
          objectType: 'table',
          name: `${model.name}_alter_${field.name}`,
          sql: SQLGenerator.generateAlterColumnSQL(model.name, previousField, field, schemaName),
          rollbackSql: SQLGenerator.generateAlterColumnSQL(model.name, field, previousField, schemaName)
        });
      });

      // Handle relation changes, RLS changes, and policy changes if needed
      if (relationsChanged || rlsChanged || policiesChanged) {
        // These changes might require more complex logic that would be implemented in SQLGenerator
        // For now, we're focusing on table and field changes
      }
    });

    return steps;
  }
} 