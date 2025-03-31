import { Enum } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface defining enum diff result
 */
export interface EnumDiff {
  added: Enum[];
  removed: Enum[];
  updated: {
    enum: Enum;
    previousValues: string[];
  }[];
}

/**
 * Orchestrates the detection and migration of enum changes between schemas
 */
export class EnumOrchestrator {
  /**
   * Compare enums between source and target schemas to identify differences
   * 
   * @param fromEnums Source enums (current state)
   * @param toEnums Target enums (desired state)
   * @returns Object containing added, removed, and updated enums
   */
  compareEnums(fromEnums: Enum[], toEnums: Enum[]): EnumDiff {
    // Create maps for faster lookups
    const fromEnumsMap = new Map<string, Enum>();
    fromEnums.forEach(enumDef => fromEnumsMap.set(enumDef.name, enumDef));
    
    const toEnumsMap = new Map<string, Enum>();
    toEnums.forEach(enumDef => toEnumsMap.set(enumDef.name, enumDef));
    
    // Find added, removed, and updated enums
    const added: Enum[] = [];
    const removed: Enum[] = [];
    const updated: { enum: Enum; previousValues: string[] }[] = [];
    
    // Find added enums (exist in target but not in source)
    toEnums.forEach(enumDef => {
      if (!fromEnumsMap.has(enumDef.name)) {
        added.push(enumDef);
      }
    });
    
    // Find removed enums (exist in source but not in target)
    fromEnums.forEach(enumDef => {
      if (!toEnumsMap.has(enumDef.name)) {
        removed.push(enumDef);
      }
    });
    
    // Find updated enums (exist in both but with different values)
    toEnums.forEach(enumDef => {
      const fromEnum = fromEnumsMap.get(enumDef.name);
      if (fromEnum) {
        // Check if values have changed
        const fromValues = new Set(fromEnum.values);
        const toValues = new Set(enumDef.values);
        
        // Check if values are different
        if (fromValues.size !== toValues.size || 
            !fromEnum.values.every(value => toValues.has(value))) {
          
          updated.push({
            enum: enumDef,
            previousValues: fromEnum.values
          });
        }
      }
    });
    
    return { added, removed, updated };
  }
  
  /**
   * Generate migration steps based on enum differences
   * 
   * @param diff The differences between source and target schemas
   * @param schemaName The schema name
   * @returns Array of migration steps for enums
   */
  generateEnumMigrationSteps(diff: EnumDiff, schemaName: string = 'public'): MigrationStep[] {
    const steps: MigrationStep[] = [];
    
    // Generate steps for added enums
    diff.added.forEach(enumDef => {
      steps.push({
        type: 'create',
        objectType: 'enum',
        name: enumDef.name,
        sql: SQLGenerator.generateCreateEnumSQL(enumDef, schemaName),
        rollbackSql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName)
      });
    });
    
    // Generate steps for removed enums
    diff.removed.forEach(enumDef => {
      steps.push({
        type: 'drop',
        objectType: 'enum',
        name: enumDef.name,
        sql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName),
        rollbackSql: SQLGenerator.generateCreateEnumSQL(enumDef, schemaName)
      });
    });
    
    // Generate steps for updated enums
    // This is more complex as we need to drop and recreate enum types
    diff.updated.forEach(({ enum: enumDef, previousValues }) => {
      // Create a previous enum definition for rollback
      const previousEnum: Enum = {
        name: enumDef.name,
        values: previousValues
      };
      
      // Drop the enum type
      steps.push({
        type: 'drop',
        objectType: 'enum',
        name: `${enumDef.name}_drop`,
        sql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName),
        rollbackSql: SQLGenerator.generateCreateEnumSQL(previousEnum, schemaName)
      });
      
      // Recreate the enum type with new values
      steps.push({
        type: 'create',
        objectType: 'enum',
        name: enumDef.name,
        sql: SQLGenerator.generateCreateEnumSQL(enumDef, schemaName),
        rollbackSql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName)
      });
    });
    
    return steps;
  }
} 