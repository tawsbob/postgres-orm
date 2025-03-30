import { Schema, Model, Enum, Field, Relation } from '../parser/types';

export interface MigrationStep {
  type: 'create' | 'alter' | 'drop';
  objectType: 'table' | 'enum' | 'extension' | 'constraint' | 'index' | 'rls';
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
  schemaName?: string;
  includeExtensions?: boolean;
  includeEnums?: boolean;
  includeTables?: boolean;
  includeConstraints?: boolean;
  includeIndexes?: boolean;
  includeRLS?: boolean;
}

export interface MigrationGenerator {
  generateMigration(schema: Schema, options?: MigrationOptions): Migration;
  generateRollbackMigration(schema: Schema, options?: MigrationOptions): Migration;
} 