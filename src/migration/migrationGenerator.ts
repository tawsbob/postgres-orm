import { Schema } from '../parser/types';
import { Migration, MigrationOptions, MigrationStep, GenerateMigrationResult } from './types';
import { SQLGenerator } from './sqlGenerator';
import { ExtensionOrchestrator } from './extension/extensionOrchestrator';
import { TableOrchestrator } from './table/tableOrchestrator';
import { EnumOrchestrator } from './enum/enumOrchestrator';
import { RLSOrchestrator } from './rls/rlsOrchestrator';
import { PolicyOrchestrator } from './rls/policyOrchestrator';
import { RoleOrchestrator } from './role/roleOrchestrator';
import { RelationOrchestrator } from './relation/relationOrchestrator';
import { TriggerOrchestrator } from './trigger/triggerOrchestrator';

export class MigrationGenerator {
  private static readonly DEFAULT_SCHEMA = 'public';
  private extensionOrchestrator: ExtensionOrchestrator;
  private tableOrchestrator: TableOrchestrator;
  private enumOrchestrator: EnumOrchestrator;
  private rlsOrchestrator: RLSOrchestrator;
  private policyOrchestrator: PolicyOrchestrator;
  private roleOrchestrator: RoleOrchestrator;
  private relationOrchestrator: RelationOrchestrator;
  private triggerOrchestrator: TriggerOrchestrator;

  constructor() {
    this.extensionOrchestrator = new ExtensionOrchestrator();
    this.tableOrchestrator = new TableOrchestrator();
    this.enumOrchestrator = new EnumOrchestrator();
    this.rlsOrchestrator = new RLSOrchestrator();
    this.policyOrchestrator = new PolicyOrchestrator();
    this.roleOrchestrator = new RoleOrchestrator();
    this.relationOrchestrator = new RelationOrchestrator();
    this.triggerOrchestrator = new TriggerOrchestrator();
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
      includePolicies = true,
      includeRelations = true,
      includeTriggers = true
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
    
    // Handle Relations using the relation orchestrator
    if (includeRelations) {
      const relationDiff = this.relationOrchestrator.compareRelations(
        fromSchema.models,
        toSchema.models
      );
      
      const relationSteps = this.relationOrchestrator.generateRelationMigrationSteps(relationDiff, schemaName);
      steps.push(...relationSteps);
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

    // Handle triggers using the trigger orchestrator
    if (includeTriggers) {
      const triggerSteps = this.triggerOrchestrator.generateTriggerSteps(
        fromSchema,
        toSchema,
        { schemaName }
      );
      steps.push(...triggerSteps);
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
      includePolicies = true,
      includeRelations = true
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

        // Add relations as foreign key constraints
        if (includeRelations && includeConstraints) {
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

  /**
   * Generate migration steps for schema changes
   * 
   * @param fromSchema Source schema
   * @param toSchema Target schema
   * @param migrationName Migration name
   * @returns Array of migration steps and affected objects
   */
  generateMigrationSteps(fromSchema: Schema, toSchema: Schema, migrationName: string): GenerateMigrationResult {
    console.log(`Generating migration steps for "${migrationName}"`);
    
    // Calculate diffs for each object type
    const tableDiff = this.tableOrchestrator.compareTables(fromSchema.models, toSchema.models);
    const relationDiff = this.relationOrchestrator.compareRelations(fromSchema.models, toSchema.models);
    const enumDiff = this.enumOrchestrator.compareEnums(fromSchema.enums, toSchema.enums);
    const extensionDiff = this.extensionOrchestrator.compareExtensions(fromSchema.extensions, toSchema.extensions);
    const roleDiff = this.roleOrchestrator.compareRoles(fromSchema.roles, toSchema.roles);

    // Debug logging for relation updates
    if (relationDiff.updated.length > 0) {
      console.log(`Found ${relationDiff.updated.length} relations with updates:`);
      relationDiff.updated.forEach(update => {
        console.log(`- Model ${update.model.name}, Relation ${update.relation.name}:`);
        console.log(`  - Previous: ${update.previousRelation.type} to ${update.previousRelation.model}`);
        console.log(`  - New: ${update.relation.type} to ${update.relation.model}`);
        
        if (update.previousRelation.fields?.join(',') !== update.relation.fields?.join(',')) {
          console.log(`  - Fields: [${update.previousRelation.fields}] -> [${update.relation.fields}]`);
        }
        
        if (update.previousRelation.references?.join(',') !== update.relation.references?.join(',')) {
          console.log(`  - References: [${update.previousRelation.references}] -> [${update.relation.references}]`);
        }
      });
    }
    
    // Debug logging for updates (existing code for table diffs)
    if (tableDiff.updated.length > 0) {
      console.log(`Found ${tableDiff.updated.length} tables with updates:`);
      tableDiff.updated.forEach(update => {
        console.log(`- Table ${update.model.name}:`);
        if (update.fieldsAdded.length > 0) {
          console.log(`  - Added fields: ${update.fieldsAdded.map(f => f.name).join(', ')}`);
        }
        if (update.fieldsRemoved.length > 0) {
          console.log(`  - Removed fields: ${update.fieldsRemoved.map(f => f.name).join(', ')}`);
        }
        if (update.fieldsUpdated.length > 0) {
          console.log(`  - Updated fields:`);
          update.fieldsUpdated.forEach(fieldUpdate => {
            const { field, previousField } = fieldUpdate;
            console.log(`    - ${field.name}:`);
            
            if (previousField.type !== field.type) {
              console.log(`      Type: ${previousField.type} -> ${field.type}`);
            }
            
            if (previousField.length !== field.length) {
              console.log(`      Length: ${previousField.length} -> ${field.length}`);
            }
            
            if (previousField.precision !== field.precision) {
              console.log(`      Precision: ${previousField.precision} -> ${field.precision}`);
            }
            
            if (previousField.scale !== field.scale) {
              console.log(`      Scale: ${previousField.scale} -> ${field.scale}`);
            }
            
            if (previousField.defaultValue !== field.defaultValue) {
              console.log(`      Default: ${previousField.defaultValue} -> ${field.defaultValue}`);
            }
            
            const prevAttrs = previousField.attributes.sort().join(',');
            const newAttrs = field.attributes.sort().join(',');
            if (prevAttrs !== newAttrs) {
              console.log(`      Attributes: [${prevAttrs}] -> [${newAttrs}]`);
            }
          });
        }
      });
    }

    // Generate migration steps for each object type
    const tableSteps = this.tableOrchestrator.generateTableMigrationSteps(tableDiff);
    const relationSteps = this.relationOrchestrator.generateRelationMigrationSteps(relationDiff);
    const enumSteps = this.enumOrchestrator.generateEnumMigrationSteps(enumDiff);
    const extensionSteps = this.extensionOrchestrator.generateExtensionMigrationSteps(extensionDiff);
    const roleSteps = this.roleOrchestrator.generateRoleMigrationSteps(roleDiff);

    // Combine all steps
    const migrationSteps: MigrationStep[] = [
      ...tableSteps,
      ...relationSteps,
      ...enumSteps,
      ...extensionSteps,
      ...roleSteps
    ];

    return {
      steps: migrationSteps,
      affectedObjects: {
        tables: tableDiff.updated.map(update => update.model),
        relations: relationDiff.updated.map(update => ({ 
          model: update.model, 
          relation: update.relation
        })),
        enums: enumDiff.updated.map(update => update.enum),
        extensions: extensionDiff.updated.map(update => update.extension),
        roles: roleDiff.updated.map(update => update.role)
      }
    };
  }
} 