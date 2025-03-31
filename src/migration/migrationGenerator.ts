import { Schema } from '../parser/types';
import { Migration, MigrationOptions, MigrationStep } from './types';
import { SQLGenerator } from './sqlGenerator';
import { ExtensionOrchestrator } from './extension/extensionOrchestrator';
import { TableOrchestrator } from './table/tableOrchestrator';
import { EnumOrchestrator } from './enum/enumOrchestrator';
import { RLSOrchestrator } from './rls/rlsOrchestrator';
import { PolicyOrchestrator } from './rls/policyOrchestrator';

export class MigrationGenerator {
  private static readonly DEFAULT_SCHEMA = 'public';
  private extensionOrchestrator: ExtensionOrchestrator;
  private tableOrchestrator: TableOrchestrator;
  private enumOrchestrator: EnumOrchestrator;
  private rlsOrchestrator: RLSOrchestrator;
  private policyOrchestrator: PolicyOrchestrator;

  constructor() {
    this.extensionOrchestrator = new ExtensionOrchestrator();
    this.tableOrchestrator = new TableOrchestrator();
    this.enumOrchestrator = new EnumOrchestrator();
    this.rlsOrchestrator = new RLSOrchestrator();
    this.policyOrchestrator = new PolicyOrchestrator();
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

    // Handle roles
    if (includeRoles) {
      // Create a map of roles by name for easier lookup
      const fromRolesMap = new Map();
      fromSchema.roles.forEach(role => fromRolesMap.set(role.name, role));
      
      const toRolesMap = new Map();
      toSchema.roles.forEach(role => toRolesMap.set(role.name, role));
      
      // Find added roles
      toSchema.roles.forEach(role => {
        if (!fromRolesMap.has(role.name)) {
          const roleSql = SQLGenerator.generateCreateRoleSQL(role, schemaName);
          const dropRoleSql = SQLGenerator.generateDropRoleSQL(role, schemaName);
          
          // Create role step
          steps.push({
            type: 'create',
            objectType: 'role',
            name: `${role.name}_create`,
            sql: roleSql[0],
            rollbackSql: dropRoleSql[0]
          });
          
          // Grant privileges steps
          roleSql.slice(1).forEach((sql, index) => {
            steps.push({
              type: 'create',
              objectType: 'role',
              name: `${role.name}_grant_${index}`,
              sql,
              rollbackSql: '' // No specific rollback for grants, dropping the role revokes everything
            });
          });
        }
      });
      
      // Find removed roles
      fromSchema.roles.forEach(role => {
        if (!toRolesMap.has(role.name)) {
          const dropRoleSql = SQLGenerator.generateDropRoleSQL(role, schemaName);
          const createRoleSql = SQLGenerator.generateCreateRoleSQL(role, schemaName);
          
          steps.push({
            type: 'drop',
            objectType: 'role',
            name: role.name,
            sql: dropRoleSql[0],
            rollbackSql: createRoleSql[0]
          });
        }
      });
      
      // Find updated roles
      // This is more complex as we need to compare privileges
      toSchema.roles.forEach(role => {
        const fromRole = fromRolesMap.get(role.name);
        if (fromRole) {
          // Check if privileges have changed
          // For simplicity, we'll drop and recreate the role if anything changed
          if (JSON.stringify(fromRole.privileges) !== JSON.stringify(role.privileges)) {
            // Drop the old role
            const dropRoleSql = SQLGenerator.generateDropRoleSQL(role, schemaName);
            steps.push({
              type: 'drop',
              objectType: 'role',
              name: `${role.name}_drop`,
              sql: dropRoleSql[0],
              rollbackSql: '' // Will be recreated in next step
            });
            
            // Create the new role
            const createRoleSql = SQLGenerator.generateCreateRoleSQL(role, schemaName);
            steps.push({
              type: 'create',
              objectType: 'role',
              name: `${role.name}_create`,
              sql: createRoleSql[0],
              rollbackSql: '' // No specific rollback needed here
            });
            
            // Grant new privileges
            createRoleSql.slice(1).forEach((sql, index) => {
              steps.push({
                type: 'create',
                objectType: 'role',
                name: `${role.name}_grant_${index}`,
                sql,
                rollbackSql: '' // No specific rollback for grants
              });
            });
          }
        }
      });
    }

    return {
      version: this.generateVersion(timestamp),
      description: 'Schema migration',
      steps,
      timestamp
    };
  }

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

    // If all options are false, return empty migration
    if (!includeExtensions && !includeEnums && !includeTables && !includeRoles && !includeConstraints && !includeIndexes && !includeRLS && !includePolicies) {
      return {
        version: this.generateVersion(timestamp),
        description: 'Empty migration',
        steps: [],
        timestamp
      };
    }

    // Generate extension steps
    if (includeExtensions) {
      schema.extensions.forEach(extension => {
        steps.push({
          type: 'create',
          objectType: 'extension',
          name: extension.name,
          sql: SQLGenerator.generateCreateExtensionSQL(extension.name, extension.version),
          rollbackSql: SQLGenerator.generateDropExtensionSQL(extension.name)
        });
      });
    }

    // Generate enum steps
    if (includeEnums) {
      // Create a simple EnumDiff with only added enums (since this is a new migration)
      const enumDiff = {
        added: schema.enums,
        removed: [],
        updated: []
      };
      
      // Use the orchestrator to generate steps
      const enumSteps = this.enumOrchestrator.generateEnumMigrationSteps(enumDiff, schemaName);
      steps.push(...enumSteps);
    }

    // Generate table steps in dependency order
    if (includeTables) {
      const sortedModels = this.sortModelsByDependencies(schema.models);
      
      // First create all tables without constraints
      sortedModels.forEach(model => {
        steps.push({
          type: 'create',
          objectType: 'table',
          name: model.name,
          sql: SQLGenerator.generateCreateTableSQL(model, schemaName),
          rollbackSql: SQLGenerator.generateDropTableSQL(model, schemaName)
        });
      });

      // Then add constraints and indexes
      sortedModels.forEach(model => {
        // Create indexes
        if (includeIndexes) {
          model.fields.forEach(field => {
            if (field.attributes.includes('unique')) {
              steps.push({
                type: 'create',
                objectType: 'index',
                name: `idx_${model.name}_${field.name}`,
                sql: SQLGenerator.generateCreateIndexSQL(model, field, schemaName),
                rollbackSql: SQLGenerator.generateDropIndexSQL(model, field, schemaName)
              });
            }
          });
        }

        // Create foreign keys
        if (includeConstraints) {
          model.relations.forEach(relation => {
            if (relation.fields && relation.references) {
              steps.push({
                type: 'create',
                objectType: 'constraint',
                name: `fk_${model.name}_${relation.name}`,
                sql: SQLGenerator.generateCreateForeignKeySQL(model, relation, schemaName),
                rollbackSql: SQLGenerator.generateDropForeignKeySQL(model, relation, schemaName)
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

    // Generate role steps
    if (includeRoles) {
      schema.roles.forEach(role => {
        const roleSql = SQLGenerator.generateCreateRoleSQL(role, schemaName);
        const dropRoleSql = SQLGenerator.generateDropRoleSQL(role, schemaName);
        
        // Create role step
        steps.push({
          type: 'create',
          objectType: 'role',
          name: `${role.name}_create`,
          sql: roleSql[0],
          rollbackSql: dropRoleSql[0]
        });

        // Grant privileges steps
        roleSql.slice(1).forEach((sql, index) => {
          steps.push({
            type: 'create',
            objectType: 'role',
            name: `${role.name}_privileges_${index}`,
            sql,
            rollbackSql: dropRoleSql[0]
          });
        });
      });
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