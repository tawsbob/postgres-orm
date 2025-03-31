import { Schema } from '../parser/types';
import { Migration, MigrationOptions, MigrationStep } from './types';
import { SQLGenerator } from './sqlGenerator';
import { ExtensionOrchestrator } from './extension/extensionOrchestrator';
import { TableOrchestrator } from './table/tableOrchestrator';
import { EnumOrchestrator } from './enum/enumOrchestrator';
import { RLSOrchestrator } from './rls/rlsOrchestrator';
import { PolicyOrchestrator } from './rls/policyOrchestrator';
import { RoleOrchestrator } from './role/roleOrchestrator';

export class MigrationGenerator {
  private static readonly DEFAULT_SCHEMA = 'public';
  private extensionOrchestrator: ExtensionOrchestrator;
  private tableOrchestrator: TableOrchestrator;
  private enumOrchestrator: EnumOrchestrator;
  private rlsOrchestrator: RLSOrchestrator;
  private policyOrchestrator: PolicyOrchestrator;
  private roleOrchestrator: RoleOrchestrator;

  constructor() {
    this.extensionOrchestrator = new ExtensionOrchestrator();
    this.tableOrchestrator = new TableOrchestrator();
    this.enumOrchestrator = new EnumOrchestrator();
    this.rlsOrchestrator = new RLSOrchestrator();
    this.policyOrchestrator = new PolicyOrchestrator();
    this.roleOrchestrator = new RoleOrchestrator();
  }

  private getTableDependencies(model: Schema['models'][0]): string[] {
    return model.relations
      .filter(relation => relation.fields && relation.references)
      .map(relation => relation.model);
  }

  private sortModelsByDependencies(models: Schema['models']): Schema['models'] {
    const visited = new Set<string>();
    const sorted: Schema['models'] = [];
    const temp = new Set<string>();

    const visit = (model: Schema['models'][0]) => {
      if (temp.has(model.name)) {
        throw new Error(`Circular dependency detected for table ${model.name}`);
      }
      if (visited.has(model.name)) return;

      temp.add(model.name);
      const dependencies = this.getTableDependencies(model);
      
      for (const depName of dependencies) {
        const depModel = models.find(m => m.name === depName);
        if (depModel) {
          visit(depModel);
        }
      }

      temp.delete(model.name);
      visited.add(model.name);
      sorted.push(model);
    };

    for (const model of models) {
      if (!visited.has(model.name)) {
        visit(model);
      }
    }

    return sorted;
  }

  /**
   * Generate migration by comparing two schemas (from source to target)
   * This is used when we need to detect changes between schemas
   * 
   * @param fromSchema Source schema (current state)
   * @param toSchema Target schema (desired state)
   * @param options Migration options
   * @returns Migration with steps to transform source schema to target schema
   */
  generateMigrationFromDiff(fromSchema: Schema, toSchema: Schema, options: MigrationOptions = {}): Migration {
    const {
      schemaName = MigrationGenerator.DEFAULT_SCHEMA,
      includeExtensions = true,
      includeEnums = true,
      includeTables = true,
      includeConstraints = true,
      includeIndexes = true,
      includeRLS = true,
      includeRoles = true,
      includePolicies = true
    } = options;

    const steps: MigrationStep[] = [];
    const timestamp = new Date().toISOString();

    // Handle extensions using the orchestrator
    if (includeExtensions) {
      const extensionDiff = this.extensionOrchestrator.compareExtensions(
        fromSchema.extensions, 
        toSchema.extensions
      );
      
      const extensionSteps = this.extensionOrchestrator.generateExtensionMigrationSteps(extensionDiff);
      steps.push(...extensionSteps);
    }

    // Handle enums using the orchestrator
    if (includeEnums) {
      const enumDiff = this.enumOrchestrator.compareEnums(
        fromSchema.enums, 
        toSchema.enums
      );
      
      const enumSteps = this.enumOrchestrator.generateEnumMigrationSteps(enumDiff, schemaName);
      steps.push(...enumSteps);
    }

    // Handle tables using the table orchestrator
    if (includeTables) {
      const tableDiff = this.tableOrchestrator.compareTables(
        fromSchema.models, 
        toSchema.models
      );
      
      const tableSteps = this.tableOrchestrator.generateTableMigrationSteps(tableDiff, schemaName);
      steps.push(...tableSteps);
    }
    
    // Handle RLS using the RLS orchestrator
    if (includeRLS) {
      const rlsDiff = this.rlsOrchestrator.compareRLS(
        fromSchema.models,
        toSchema.models
      );
      
      const rlsSteps = this.rlsOrchestrator.generateRLSMigrationSteps(rlsDiff, schemaName);
      steps.push(...rlsSteps);
    }
    
    // Handle policies using the policy orchestrator
    if (includePolicies) {
      const policyDiff = this.policyOrchestrator.comparePolicies(
        fromSchema.models,
        toSchema.models
      );
      
      const policySteps = this.policyOrchestrator.generatePolicyMigrationSteps(policyDiff, schemaName);
      steps.push(...policySteps);
    }

    // Handle roles using the role orchestrator
    if (includeRoles) {
      const roleDiff = this.roleOrchestrator.compareRoles(
        fromSchema.roles,
        toSchema.roles
      );
      
      const roleSteps = this.roleOrchestrator.generateRoleMigrationSteps(roleDiff, schemaName);
      steps.push(...roleSteps);
    }

    return {
      version: this.generateVersion(timestamp),
      description: 'Migration based on schema changes',
      steps,
      timestamp
    };
  }

  /**
   * Generate migration from a target schema
   * This is used when we want to generate a migration based solely on the target schema
   * 
   * @param schema Target schema to create migration for
   * @param options Migration options
   * @returns Migration for creating all objects in the schema
   */
  generateMigration(schema: Schema, options: MigrationOptions = {}): Migration {
    const {
      schemaName = MigrationGenerator.DEFAULT_SCHEMA,
      includeExtensions = true,
      includeEnums = true,
      includeTables = true,
      includeConstraints = true,
      includeIndexes = true,
      includeRLS = true,
      includeRoles = true,
      includePolicies = true
    } = options;

    const steps: MigrationStep[] = [];
    const timestamp = new Date().toISOString();

    // Handle extensions
    if (includeExtensions) {
      schema.extensions.forEach(extension => {
        const extensionSql = SQLGenerator.generateCreateExtensionSQL(extension.name, extension.version);
        const dropExtensionSql = SQLGenerator.generateDropExtensionSQL(extension.name);
        
        steps.push({
          type: 'create',
          objectType: 'extension',
          name: extension.name,
          sql: extensionSql,
          rollbackSql: dropExtensionSql
        });
      });
    }

    // Handle enums
    if (includeEnums) {
      schema.enums.forEach(enumDef => {
        const enumSql = SQLGenerator.generateCreateEnumSQL(enumDef, schemaName);
        const dropEnumSql = SQLGenerator.generateDropEnumSQL(enumDef, schemaName);
        
        steps.push({
          type: 'create',
          objectType: 'enum',
          name: enumDef.name,
          sql: enumSql,
          rollbackSql: dropEnumSql
        });
      });
    }

    // Handle tables, constraints, and indexes
    if (includeTables) {
      // Sort models topologically (based on dependencies)
      const sortedModels = this.sortModelsByDependencies(schema.models);
      
      sortedModels.forEach(model => {
        // Create table
        const tableSql = SQLGenerator.generateCreateTableSQL(model, schemaName);
        const dropTableSql = SQLGenerator.generateDropTableSQL(model, schemaName);
        
        steps.push({
          type: 'create',
          objectType: 'table',
          name: model.name,
          sql: tableSql,
          rollbackSql: dropTableSql
        });

        // Add constraints for relations
        if (includeConstraints) {
          model.relations.forEach(relation => {
            if (relation.fields && relation.references) {
              const constraintSql = SQLGenerator.generateCreateForeignKeySQL(model, relation, schemaName);
              const dropConstraintSql = SQLGenerator.generateDropForeignKeySQL(model, relation, schemaName);
              
              steps.push({
                type: 'create',
                objectType: 'constraint',
                name: `${model.name}_${relation.name}_fkey`,
                sql: constraintSql,
                rollbackSql: dropConstraintSql
              });
            }
          });
        }

        // Create indexes
        if (includeIndexes) {
          model.fields.forEach(field => {
            if (field.attributes.includes('unique') && !field.attributes.includes('id')) {
              const indexSql = SQLGenerator.generateCreateIndexSQL(model, field, schemaName);
              const dropIndexSql = SQLGenerator.generateDropIndexSQL(model, field, schemaName);
              
              steps.push({
                type: 'create',
                objectType: 'index',
                name: `${model.name}_${field.name}_idx`,
                sql: indexSql,
                rollbackSql: dropIndexSql
              });
            }
          });
        }

        // Configure RLS
        if (includeRLS && model.rowLevelSecurity) {
          // Create fake diff entry for a model with RLS
          const rlsDiff = {
            added: [{ model }],
            removed: [],
            updated: []
          };
          
          // Use the RLS orchestrator to generate steps
          const rlsSteps = this.rlsOrchestrator.generateRLSMigrationSteps(rlsDiff, schemaName);
          steps.push(...rlsSteps);
        }

        // Add policies using the policy orchestrator
        if (includePolicies && model.policies && model.policies.length > 0) {
          // Create a fake diff entry for a model with policies
          const policyDiff = {
            added: model.policies.map(policy => ({ model, policy })),
            removed: [],
            updated: []
          };
          
          // Use the policy orchestrator to generate steps
          const policySteps = this.policyOrchestrator.generatePolicyMigrationSteps(policyDiff, schemaName);
          steps.push(...policySteps);
        }
      });
    }

    // Generate role steps using the role orchestrator
    if (includeRoles && schema.roles.length > 0) {
      // Create a fake diff entry for roles
      const roleDiff = {
        added: schema.roles,
        removed: [],
        updated: []
      };
      
      // Use the role orchestrator to generate steps
      const roleSteps = this.roleOrchestrator.generateRoleMigrationSteps(roleDiff, schemaName);
      steps.push(...roleSteps);
    }

    return {
      version: this.generateVersion(timestamp),
      description: 'Initial schema migration',
      steps,
      timestamp
    };
  }

  generateRollbackMigration(schema: Schema, options: MigrationOptions = {}): Migration {
    const migration = this.generateMigration(schema, options);
    
    // Reverse the steps order and swap SQL with rollbackSql
    migration.steps = migration.steps
      .reverse()
      .map(step => {
        if (step.objectType === 'role') {
          // For roles, always use the comprehensive drop role SQL
          const role = schema.roles.find(r => r.name === step.name.split('_')[0])!;
          const dropRoleSql = SQLGenerator.generateDropRoleSQL(role, options.schemaName);
          const createRoleSql = SQLGenerator.generateCreateRoleSQL(role, options.schemaName);
          
          return {
            ...step,
            sql: dropRoleSql[0],
            rollbackSql: createRoleSql[0]
          };
        }
        return {
          ...step,
          sql: step.rollbackSql,
          rollbackSql: step.sql
        };
      });

    migration.description = 'Rollback migration';
    return migration;
  }

  private generateVersion(timestamp: string): string {
    // Format: YYYYMMDDHHMMSS
    return timestamp.replace(/[^0-9]/g, '').slice(0, 14);
  }
} 