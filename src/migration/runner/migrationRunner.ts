import { Migration } from '../types';
import { 
  MigrationRunner, 
  MigrationRecord, 
  MigrationRunnerOptions, 
  MigrationRunResult,
  RollbackOptions,
  RollbackResult
} from './types';
import { MigrationDatabase } from './db';
import { MigrationFile, MigrationFileSystem } from './fileSystem';

export interface MigrationRunnerConfig {
  connectionString?: string;
  migrationsDir: string;
  schemaName?: string;
  migrationsTableName?: string;
}

export class PostgresMigrationRunner implements MigrationRunner {
  private db: MigrationDatabase;
  private fs: MigrationFileSystem;

  constructor(config: MigrationRunnerConfig) {
    this.db = new MigrationDatabase(
      config.connectionString,
      config.schemaName,
      config.migrationsTableName
    );
    this.fs = new MigrationFileSystem(config.migrationsDir);
  }

  async init(): Promise<void> {
    await this.fs.ensureMigrationsDir();
    await this.db.initMigrationsTable();
  }

  async getMigrationsStatus(): Promise<{ applied: MigrationRecord[]; pending: Migration[] }> {
    const appliedMigrations = await this.db.getAppliedMigrations();
    const migrationFiles = await this.fs.loadMigrationFiles();
    
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    const pendingMigrationFiles = migrationFiles.filter(m => !appliedVersions.has(m.version));
    
    return {
      applied: appliedMigrations,
      pending: pendingMigrationFiles.map(m => m.content)
    };
  }

  async runMigrations(options: MigrationRunnerOptions = {}): Promise<MigrationRunResult> {
    await this.init();
    
    const { applied, pending } = await this.getMigrationsStatus();
    
    if (pending.length === 0) {
      return { success: true, appliedMigrations: [] };
    }
    
    const appliedMigrations: string[] = [];
    
    try {
      if (options.dryRun) {
        // In dry run mode, just report what would be applied
        return {
          success: true,
          appliedMigrations: pending.map(m => m.version)
        };
      }
      
      // Execute migrations within a transaction
      await this.db.withTransaction(async client => {
        for (const migration of pending) {
          console.log(`Applying migration ${migration.version}: ${migration.description}`);
          
          for (const step of migration.steps) {
            await this.db.executeSQL(client, step.sql);
          }
          
          await this.db.recordMigration(
            client, 
            migration.version,
            migration.description,
            migration.timestamp
          );
          
          appliedMigrations.push(migration.version);
        }
      });
      
      return {
        success: true,
        appliedMigrations
      };
    } catch (error) {
      return {
        success: false,
        appliedMigrations,
        error: error as Error
      };
    }
  }

  async rollback(options: RollbackOptions = {}): Promise<RollbackResult> {
    await this.init();
    
    const appliedMigrations = await this.db.getAppliedMigrations();
    if (appliedMigrations.length === 0) {
      return { success: true, rolledBackMigrations: [] };
    }
    
    // Load all migration files for rollback
    const migrationFiles = await this.fs.loadMigrationFiles();
    const migrationsMap = new Map<string, MigrationFile>();
    migrationFiles.forEach(m => migrationsMap.set(m.version, m));
    
    // Determine which migrations to roll back
    let migrationsToRollback: MigrationRecord[] = [];
    
    if (options.toVersion) {
      // Find the index of the target version
      const targetIndex = appliedMigrations.findIndex(m => m.version === options.toVersion);
      if (targetIndex === -1) {
        throw new Error(`Target version ${options.toVersion} not found in applied migrations`);
      }
      migrationsToRollback = appliedMigrations.slice(targetIndex + 1).reverse();
    } else {
      // Roll back the specified number of steps (default 1)
      const steps = options.steps || 1;
      migrationsToRollback = appliedMigrations.slice(-steps).reverse();
    }
    
    if (migrationsToRollback.length === 0) {
      return { success: true, rolledBackMigrations: [] };
    }
    
    const rolledBackMigrations: string[] = [];
    
    try {
      if (options.dryRun) {
        return {
          success: true,
          rolledBackMigrations: migrationsToRollback.map(m => m.version)
        };
      }
      
      // Execute rollbacks within a transaction
      await this.db.withTransaction(async client => {
        for (const migration of migrationsToRollback) {
          const migrationFile = migrationsMap.get(migration.version);
          
          if (!migrationFile) {
            throw new Error(`Migration file for version ${migration.version} not found`);
          }
          
          console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
          
          // Apply rollback steps in reverse order
          for (const step of [...migrationFile.content.steps].reverse()) {
            await this.db.executeSQL(client, step.rollbackSql);
          }
          
          await this.db.removeMigrationRecord(client, migration.version);
          rolledBackMigrations.push(migration.version);
        }
      });
      
      return {
        success: true,
        rolledBackMigrations
      };
    } catch (error) {
      return {
        success: false,
        rolledBackMigrations,
        error: error as Error
      };
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }
} 