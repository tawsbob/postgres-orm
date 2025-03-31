import { Extension } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface defining extension diff result
 */
export interface ExtensionDiff {
  added: Extension[];
  removed: Extension[];
  updated: {
    extension: Extension;
    previousVersion: string;
  }[];
}

/**
 * Class responsible for orchestrating extension changes between schema versions
 */
export class ExtensionOrchestrator {
  /**
   * Compare extensions between two schemas and identify differences
   * 
   * @param fromExtensions Source extensions
   * @param toExtensions Target extensions
   * @returns Object containing added, removed, and updated extensions
   */
  compareExtensions(fromExtensions: Extension[], toExtensions: Extension[]): ExtensionDiff {
    const added: Extension[] = [];
    const removed: Extension[] = [];
    const updated: { extension: Extension; previousVersion: string }[] = [];

    // Map fromExtensions by name for easier lookup
    const fromExtensionsMap = new Map<string, Extension>();
    fromExtensions.forEach(ext => fromExtensionsMap.set(ext.name, ext));

    // Map toExtensions by name for easier lookup
    const toExtensionsMap = new Map<string, Extension>();
    toExtensions.forEach(ext => toExtensionsMap.set(ext.name, ext));

    // Find added and updated extensions
    toExtensions.forEach(ext => {
      const fromExt = fromExtensionsMap.get(ext.name);
      if (!fromExt) {
        // Extension doesn't exist in fromExtensions - it's been added
        added.push(ext);
      } else if (ext.version !== fromExt.version) {
        // Extension exists but with a different version - it's been updated
        updated.push({
          extension: ext,
          previousVersion: fromExt.version || ''
        });
      }
    });

    // Find removed extensions
    fromExtensions.forEach(ext => {
      if (!toExtensionsMap.has(ext.name)) {
        // Extension exists in fromExtensions but not in toExtensions - it's been removed
        removed.push(ext);
      }
    });

    return { added, removed, updated };
  }

  /**
   * Generate migration steps based on extension differences
   * 
   * @param diff The differences between source and target schemas
   * @returns Array of migration steps for extensions
   */
  generateExtensionMigrationSteps(diff: ExtensionDiff): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Generate steps for added extensions
    diff.added.forEach(extension => {
      steps.push({
        type: 'create',
        objectType: 'extension',
        name: extension.name,
        sql: SQLGenerator.generateCreateExtensionSQL(extension.name, extension.version),
        rollbackSql: SQLGenerator.generateDropExtensionSQL(extension.name)
      });
    });

    // Generate steps for removed extensions
    diff.removed.forEach(extension => {
      steps.push({
        type: 'drop',
        objectType: 'extension',
        name: extension.name,
        sql: SQLGenerator.generateDropExtensionSQL(extension.name),
        rollbackSql: SQLGenerator.generateCreateExtensionSQL(extension.name, extension.version)
      });
    });

    // Generate steps for updated extensions
    diff.updated.forEach(({ extension, previousVersion }) => {
      // First drop the extension with the old version
      steps.push({
        type: 'drop',
        objectType: 'extension',
        name: `${extension.name}_old`,
        sql: SQLGenerator.generateDropExtensionSQL(extension.name),
        rollbackSql: SQLGenerator.generateCreateExtensionSQL(extension.name, previousVersion)
      });

      // Then create the extension with the new version
      steps.push({
        type: 'create',
        objectType: 'extension',
        name: extension.name,
        sql: SQLGenerator.generateCreateExtensionSQL(extension.name, extension.version),
        rollbackSql: SQLGenerator.generateDropExtensionSQL(extension.name)
      });
    });

    return steps;
  }
} 