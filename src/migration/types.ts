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
  generateMigration(schema: Schema, options?: MigrationOptions): Migration;
  generateRollbackMigration(schema: Schema, options?: MigrationOptions): Migration;
} 