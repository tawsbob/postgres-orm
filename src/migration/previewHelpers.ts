import { Migration, MigrationOptions } from './types';

/**
 * Interface for migration preview options
 */
export interface MigrationPreviewOptions extends MigrationOptions {
  showUpMigration?: boolean;
  showDownMigration?: boolean;
  showStats?: boolean;
  format?: 'pretty' | 'raw' | 'json';
}

/**
 * Default migration preview options
 */
export const DEFAULT_PREVIEW_OPTIONS: MigrationPreviewOptions = {
  showUpMigration: true,
  showDownMigration: true,
  showStats: true,
  format: 'pretty',
  schemaName: 'public',
  includeExtensions: true,
  includeEnums: true,
  includeTables: true,
  includeConstraints: true,
  includeIndexes: true,
  includeRLS: true,
  includeRoles: true
};

/**
 * Formats migration steps for preview output
 */
export function formatMigrationForPreview(
  migration: Migration, 
  options: MigrationPreviewOptions = DEFAULT_PREVIEW_OPTIONS
): string {
  const output: string[] = [];
  
  // Basic migration info
  output.push('\n🚀 Migration Preview:');
  output.push('==================');
  output.push(`Version: ${migration.version}`);
  output.push(`Description: ${migration.description}`);
  output.push(`Timestamp: ${migration.timestamp}`);
  
  // Up migration
  if (options.showUpMigration !== false) {
    output.push('\n⬆️ Up Migration:');
    output.push('---------------');
    
    const sortedSteps = [...migration.steps].sort((a, b) => {
      // Extensions first
      if (a.objectType === 'extension' && b.objectType !== 'extension') return -1;
      if (a.objectType !== 'extension' && b.objectType === 'extension') return 1;
      // Then enums
      if (a.objectType === 'enum' && b.objectType !== 'enum') return -1;
      if (a.objectType !== 'enum' && b.objectType === 'enum') return 1;
      return 0;
    });
    
    sortedSteps.forEach((step, index) => {
      output.push(`\n--- Step ${index + 1}: ${step.type} ${step.objectType} '${step.name}' ---`);
      output.push(step.sql);
    });
  }
  
  // Down migration
  if (options.showDownMigration !== false) {
    output.push('\n⬇️ Down Migration:');
    output.push('----------------');
    
    const reverseSortedSteps = [...migration.steps].reverse().sort((a, b) => {
      // Tables last (they should be dropped after their constraints)
      if (a.objectType === 'table' && b.objectType !== 'table') return 1;
      if (a.objectType !== 'table' && b.objectType === 'table') return -1;
      // Then enums
      if (a.objectType === 'enum' && b.objectType !== 'enum') return -1;
      if (a.objectType !== 'enum' && b.objectType === 'enum') return 1;
      // Then extensions
      if (a.objectType === 'extension' && b.objectType !== 'extension') return -1;
      if (a.objectType !== 'extension' && b.objectType === 'extension') return 1;
      return 0;
    });
    
    reverseSortedSteps.forEach((step, index) => {
      output.push(`\n--- Step ${index + 1}: drop ${step.objectType} '${step.name}' ---`);
      output.push(step.rollbackSql);
    });
  }
  
  // Migration statistics
  if (options.showStats !== false) {
    output.push('\n📊 Migration Statistics:');
    output.push('=====================');
    
    const stepsByType = {} as Record<string, number>;
    migration.steps.forEach(step => {
      if (!stepsByType[step.objectType]) {
        stepsByType[step.objectType] = 0;
      }
      stepsByType[step.objectType]++;
    });
    
    output.push(`Total Steps: ${migration.steps.length}`);
    
    for (const [type, count] of Object.entries(stepsByType)) {
      output.push(`- ${type}: ${count}`);
    }
  }
  
  return output.join('\n');
}

/**
 * Generates JSON format of the migration
 */
export function migrationToJson(migration: Migration): string {
  return JSON.stringify(migration, null, 2);
}

/**
 * Generates raw SQL format of the migration (suitable for direct execution)
 */
export function migrationToRawSql(migration: Migration): string {
  const output: string[] = [
    `-- Migration: ${migration.description}`,
    `-- Version: ${migration.version}`,
    `-- Timestamp: ${migration.timestamp}`,
    '',
    '-- Up Migration',
    'BEGIN;',
    ''
  ];

  // Sort steps to ensure extensions are created first, then enums, then tables
  const sortedSteps = [...migration.steps].sort((a, b) => {
    // Extensions first
    if (a.objectType === 'extension' && b.objectType !== 'extension') return -1;
    if (a.objectType !== 'extension' && b.objectType === 'extension') return 1;
    // Then enums
    if (a.objectType === 'enum' && b.objectType !== 'enum') return -1;
    if (a.objectType !== 'enum' && b.objectType === 'enum') return 1;
    return 0;
  });

  // Add up migration steps
  sortedSteps.forEach(step => {
    output.push(`-- ${step.objectType}: ${step.name}`);
    output.push(step.sql);
    output.push('');
  });

  output.push('COMMIT;', '', '-- Down Migration', 'BEGIN;', '');

  // For down migration, we need to handle dependencies in reverse order
  const reverseSortedSteps = [...migration.steps].reverse().sort((a, b) => {
    // Tables last (they should be dropped after their constraints)
    if (a.objectType === 'table' && b.objectType !== 'table') return 1;
    if (a.objectType !== 'table' && b.objectType === 'table') return -1;
    // Then enums
    if (a.objectType === 'enum' && b.objectType !== 'enum') return -1;
    if (a.objectType !== 'enum' && b.objectType === 'enum') return 1;
    // Then extensions
    if (a.objectType === 'extension' && b.objectType !== 'extension') return -1;
    if (a.objectType !== 'extension' && b.objectType === 'extension') return 1;
    return 0;
  });

  // Add down migration steps
  reverseSortedSteps.forEach(step => {
    output.push(`-- ${step.objectType}: ${step.name}`);
    output.push(step.rollbackSql);
    output.push('');
  });

  output.push('COMMIT;');

  return output.join('\n');
} 