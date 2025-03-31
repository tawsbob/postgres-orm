import { Schema } from '../parser/types';

export interface MigrationStep {
  type: 'create' | 'alter' | 'drop';
  objectType: 'table' | 'enum' | 'extension' | 'constraint' | 'index' | 'rls' | 'role' | 'policy';
  name: string;
  sql: string;
  rollbackSql: string;
}

export interface Migration {
  version: string;
  description: string;
  steps: MigrationStep[];
  timestamp: string;
}

export interface MigrationOptions {
  timestamp?: Date;
  schemaName?: string;
  includeExtensions?: boolean;
  includeEnums?: boolean;
  includeTables?: boolean;
  includeConstraints?: boolean;
  includeIndexes?: boolean;
  includeRLS?: boolean;
  includeRoles?: boolean;
  includePolicies?: boolean;
}

export interface MigrationGenerator {
  /**
   * Generate a migration from a target schema
   * Used for creating a fresh migration from a single schema
   * 
   * @param schema Target schema to create migration for
   * @param options Migration generation options
   */
  generateMigration(schema: Schema, options?: MigrationOptions): Migration;
  
  /**
   * Generate a migration by comparing source and target schemas
   * Used for detecting differences between schemas and creating migrations
   * 
   * @param fromSchema Source schema (current state)
   * @param toSchema Target schema (desired state)
   * @param options Migration generation options
   */
  generateMigrationFromDiff(fromSchema: Schema, toSchema: Schema, options?: MigrationOptions): Migration;
  
  /**
   * Generate a rollback migration
   * 
   * @param schema Schema to create rollback for
   * @param options Migration generation options
   */
  generateRollbackMigration(schema: Schema, options?: MigrationOptions): Migration;
} 