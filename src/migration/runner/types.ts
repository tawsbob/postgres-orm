import { Migration } from '../types';

export interface MigrationRecord {
  id: number;
  version: string;
  name: string;
  timestamp: string;
  applied_at: Date;
}

export interface MigrationRunnerOptions {
  schemaName?: string;
  migrationsTableName?: string;
  dryRun?: boolean;
}

export interface MigrationRunResult {
  success: boolean;
  appliedMigrations: string[];
  error?: Error;
}

export interface RollbackOptions {
  steps?: number;
  toVersion?: string;
  dryRun?: boolean;
}

export interface RollbackResult {
  success: boolean;
  rolledBackMigrations: string[];
  error?: Error;
}

export interface MigrationRunner {
  init(): Promise<void>;
  getMigrationsStatus(): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
  }>;
  runMigrations(options?: MigrationRunnerOptions): Promise<MigrationRunResult>;
  rollback(options?: RollbackOptions): Promise<RollbackResult>;
} 