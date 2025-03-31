import { Schema } from '../parser/types';
import { Migration, MigrationOptions, MigrationStep } from './types';
import { SQLGenerator } from './sqlGenerator';
import { ExtensionOrchestrator } from './extension/extensionOrchestrator';
import { TableOrchestrator } from './table/tableOrchestrator';

export class MigrationGenerator {
  private static readonly DEFAULT_SCHEMA = 'public';
  private extensionOrchestrator: ExtensionOrchestrator;
  private tableOrchestrator: TableOrchestrator;

  constructor() {
    this.extensionOrchestrator = new ExtensionOrchestrator();
    this.tableOrchestrator = new TableOrchestrator();
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

    // Handle enums using direct comparison
    if (includeEnums) {
      // Create a map of enums by name for easier lookup
      const fromEnumsMap = new Map();
      fromSchema.enums.forEach(enumDef => fromEnumsMap.set(enumDef.name, enumDef));
      
      const toEnumsMap = new Map();
      toSchema.enums.forEach(enumDef => toEnumsMap.set(enumDef.name, enumDef));
      
      // Find added enums
      toSchema.enums.forEach(enumDef => {
        if (!fromEnumsMap.has(enumDef.name)) {
          steps.push({
            type: 'create',
            objectType: 'enum',
            name: enumDef.name,
            sql: SQLGenerator.generateCreateEnumSQL(enumDef, schemaName),
            rollbackSql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName)
          });
        }
      });
      
      // Find removed enums
      fromSchema.enums.forEach(enumDef => {
        if (!toEnumsMap.has(enumDef.name)) {
          steps.push({
            type: 'drop',
            objectType: 'enum',
            name: enumDef.name,
            sql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName),
            rollbackSql: SQLGenerator.generateCreateEnumSQL(enumDef, schemaName)
          });
        }
      });
      
      // Find updated enums
      // This is more complex as we need to drop and recreate enum types
      toSchema.enums.forEach(enumDef => {
        const fromEnum = fromEnumsMap.get(enumDef.name);
        if (fromEnum) {
          // Check if values have changed
          const fromValues = new Set(fromEnum.values);
          const toValues = new Set(enumDef.values);
          
          // Check if values are different
          if (fromValues.size !== toValues.size || 
              !fromEnum.values.every((value: string) => toValues.has(value))) {
            
            // Drop and recreate the enum type
            steps.push({
              type: 'drop',
              objectType: 'enum',
              name: `${enumDef.name}_drop`,
              sql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName),
              rollbackSql: SQLGenerator.generateCreateEnumSQL(fromEnum, schemaName)
            });
            
            steps.push({
              type: 'create',
              objectType: 'enum',
              name: enumDef.name,
              sql: SQLGenerator.generateCreateEnumSQL(enumDef, schemaName),
              rollbackSql: SQLGenerator.generateDropEnumSQL(enumDef, schemaName)
            });
          }
        }
      });
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
      schema.enums.forEach(enumType => {
        steps.push({
          type: 'create',
          objectType: 'enum',
          name: enumType.name,
          sql: SQLGenerator.generateCreateEnumSQL(enumType, schemaName),
          rollbackSql: SQLGenerator.generateDropEnumSQL(enumType, schemaName)
        });
      });
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
          const rlsSql = SQLGenerator.generateRLSSQL(model, schemaName);
          rlsSql.forEach((sql, index) => {
            steps.push({
              type: 'create',
              objectType: 'rls',
              name: `rls_${model.name}_${index}`,
              sql,
              rollbackSql: SQLGenerator.generateDisableRLSSQL(model, schemaName)
            });
          });
        }

        // Add policies
        if (includePolicies && model.policies && model.policies.length > 0) {
          model.policies.forEach(policy => {
            const policyCreateSql = SQLGenerator.generateCreatePolicySQL(model, policy, schemaName);
            const policyDropSql = SQLGenerator.generateDropPolicySQL(model, policy, schemaName);
            
            steps.push({
              type: 'create',
              objectType: 'policy',
              name: `policy_${model.name}_${policy.name}`,
              sql: policyCreateSql,
              rollbackSql: policyDropSql
            });
          });
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