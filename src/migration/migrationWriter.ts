import fs from 'fs';
import path from 'path';
import { Migration } from './types';

export class MigrationWriter {
  constructor(private migrationsDir: string) {
    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
  }

  writeMigration(migration: Migration): string {
    const fileName = `${migration.version}_${migration.description.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filePath = path.join(this.migrationsDir, fileName);

    const content = this.generateMigrationContent(migration);
    fs.writeFileSync(filePath, content);

    return filePath;
  }

  private generateMigrationContent(migration: Migration): string {
    const lines: string[] = [
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
      lines.push(`-- ${step.objectType}: ${step.name}`);
      lines.push(step.sql);
      lines.push('');
    });

    lines.push('COMMIT;', '', '-- Down Migration', 'BEGIN;', '');

    // For down migration, we need to handle dependencies in reverse order
    // First drop constraints and indexes
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
      lines.push(`-- ${step.objectType}: ${step.name}`);
      lines.push(step.rollbackSql);
      lines.push('');
    });

    lines.push('COMMIT;');

    return lines.join('\n');
  }
} 