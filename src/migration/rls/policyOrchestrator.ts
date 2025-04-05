import { Model, Policy } from '../../parser/types';
import { MigrationStep } from '../types';
import { SQLGenerator } from '../sqlGenerator';

/**
 * Interface defining policy diff result
 */
export interface PolicyDiff {
  added: {
    model: Model;
    policy: Policy;
  }[];
  removed: {
    model: Model;
    policy: Policy;
  }[];
  updated: {
    model: Model;
    policy: Policy;
    previousPolicy: Policy;
  }[];
}

/**
 * Class responsible for orchestrating policy changes between schema versions
 */
export class PolicyOrchestrator {
  /**
   * Compare policies between two schema versions
   * 
   * @param fromModels Source models
   * @param toModels Target models
   * @returns Object containing added, removed, and updated policies
   */
  comparePolicies(fromModels: Model[], toModels: Model[]): PolicyDiff {
    const added: { model: Model; policy: Policy }[] = [];
    const removed: { model: Model; policy: Policy }[] = [];
    const updated: { model: Model; policy: Policy; previousPolicy: Policy }[] = [];

    // Map fromModels by name for easier lookup
    const fromModelsMap = new Map<string, Model>();
    fromModels.forEach(model => fromModelsMap.set(model.name, model));

    // Map toModels by name for easier lookup
    const toModelsMap = new Map<string, Model>();
    toModels.forEach(model => toModelsMap.set(model.name, model));

    // Check for added and updated policies
    toModels.forEach(toModel => {
      const fromModel = fromModelsMap.get(toModel.name);
      
      // If the model exists in both schemas
      if (fromModel) {
        // Skip if there are no policies in either model
        if (!fromModel.policies?.length && !toModel.policies?.length) {
          return;
        }
        
        // If the target model has policies
        if (toModel.policies?.length) {
          // Go through each policy in the target model
          toModel.policies.forEach(toPolicy => {
            // Check if the policy exists in the source model
            const fromPolicy = fromModel.policies?.find(p => p.name === toPolicy.name);
            
            if (fromPolicy) {
              // If policy exists in both, check if it has changed
              if (this.hasPolicyChanged(fromPolicy, toPolicy)) {
                updated.push({
                  model: toModel,
                  policy: toPolicy,
                  previousPolicy: fromPolicy
                });
              }
            } else {
              // If policy only exists in target, it's added
              added.push({
                model: toModel,
                policy: toPolicy
              });
            }
          });
        }
        
        // Check for removed policies (exist in source but not in target)
        if (fromModel.policies?.length) {
          fromModel.policies.forEach(fromPolicy => {
            const toPolicy = toModel.policies?.find(p => p.name === fromPolicy.name);
            if (!toPolicy) {
              removed.push({
                model: fromModel,
                policy: fromPolicy
              });
            }
          });
        }
      } 
      // If the model only exists in the target schema and has policies
      else if (toModel.policies?.length) {
        toModel.policies.forEach(policy => {
          added.push({
            model: toModel,
            policy
          });
        });
      }
    });

    // Check for removed policies (model exists in source but not in target)
    fromModels.forEach(fromModel => {
      if (!toModelsMap.has(fromModel.name) && fromModel.policies?.length) {
        fromModel.policies.forEach(policy => {
          removed.push({
            model: fromModel,
            policy
          });
        });
      }
    });

    return { added, removed, updated };
  }

  /**
   * Check if policy settings have changed
   * 
   * @param fromPolicy Source policy
   * @param toPolicy Target policy
   * @returns Whether the policy has changed
   */
  private hasPolicyChanged(fromPolicy: Policy, toPolicy: Policy): boolean {
    // Check if 'for' has changed
    const forChanged = Array.isArray(fromPolicy.for) !== Array.isArray(toPolicy.for) ||
      (Array.isArray(fromPolicy.for) && Array.isArray(toPolicy.for) && 
       (fromPolicy.for.length !== toPolicy.for.length || 
        !fromPolicy.for.every(action => toPolicy.for.includes(action))));
    
    // Check if 'to' or 'using' or 'check' have changed
    const toChanged = fromPolicy.to !== toPolicy.to;
    const usingChanged = fromPolicy.using !== toPolicy.using;
    const checkChanged = fromPolicy.check !== toPolicy.check;
    
    return forChanged || toChanged || usingChanged || checkChanged;
  }

  /**
   * Generate migration steps based on policy differences
   * 
   * @param diff The differences between source and target schemas
   * @param schemaName The schema name
   * @returns Array of migration steps for policies
   */
  generatePolicyMigrationSteps(diff: PolicyDiff, schemaName: string = 'public'): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Generate steps for added policies
    diff.added.forEach(({ model, policy }) => {
      steps.push({
        type: 'create',
        objectType: 'policy',
        name: `policy_${model.name}_${policy.name}`,
        sql: SQLGenerator.generateCreatePolicySQL(model, policy, schemaName),
        rollbackSql: SQLGenerator.generateDropPolicySQL(model, policy, schemaName)
      });
    });

    // Generate steps for removed policies
    diff.removed.forEach(({ model, policy }) => {
      steps.push({
        type: 'drop',
        objectType: 'policy',
        name: `policy_${model.name}_${policy.name}`,
        sql: SQLGenerator.generateDropPolicySQL(model, policy, schemaName),
        rollbackSql: SQLGenerator.generateCreatePolicySQL(model, policy, schemaName)
      });
    });

    // Generate steps for updated policies
    // Since policies can't be altered, we need to drop and recreate them
    diff.updated.forEach(({ model, policy, previousPolicy }) => {
      // First drop the old policy
      steps.push({
        type: 'drop',
        objectType: 'policy',
        name: `policy_${model.name}_${policy.name}_drop`,
        sql: SQLGenerator.generateDropPolicySQL(model, previousPolicy, schemaName),
        rollbackSql: SQLGenerator.generateCreatePolicySQL(model, previousPolicy, schemaName)
      });
      
      // Then create the new policy
      steps.push({
        type: 'create',
        objectType: 'policy',
        name: `policy_${model.name}_${policy.name}_create`,
        sql: SQLGenerator.generateCreatePolicySQL(model, policy, schemaName),
        rollbackSql: SQLGenerator.generateDropPolicySQL(model, policy, schemaName)
      });
    });

    return steps;
  }
} 