import { Schema, Model, Trigger } from '../../parser/types';
import { MigrationStep } from '../types';

export class TriggerOrchestrator {
  /**
   * Generates migration steps for triggers based on schema differences
   */
  generateTriggerSteps(
    fromSchema: Schema,
    toSchema: Schema,
    options: { schemaName?: string } = {}
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];
    const schemaName = options.schemaName || 'public';

    // Get all models from both schemas
    const fromModels = new Map(fromSchema.models.map(m => [m.name, m]));
    const toModels = new Map(toSchema.models.map(m => [m.name, m]));

    // Compare triggers for each model
    for (const [modelName, toModel] of toModels) {
      // Debug logs removed for cleaner output
      // console.log('Processing model:', modelName);
      // console.log('From model triggers:', fromModels.get(modelName)?.triggers);
      // console.log('To model triggers:', toModel.triggers);
      
      const fromModel = fromModels.get(modelName);
      
      if (!fromModel) {
        // New model, add all its triggers
        if (toModel.triggers?.length) {
          steps.push(...this.generateCreateTriggerSteps(toModel, schemaName));
        }
        continue;
      }

      // Compare existing model's triggers
      steps.push(...this.compareModelTriggers(fromModel, toModel, schemaName));
    }

    // Check for removed models with triggers
    for (const [modelName, fromModel] of fromModels) {
      if (!toModels.has(modelName) && fromModel.triggers?.length) {
        steps.push(...this.generateDropTriggerSteps(fromModel, schemaName));
      }
    }

    return steps;
  }

  private compareModelTriggers(
    fromModel: Model,
    toModel: Model,
    schemaName: string
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];
    const fromTriggers = new Map(
      fromModel.triggers?.map(t => [this.getTriggerKey(t), t]) || []
    );
    const toTriggers = new Map(
      toModel.triggers?.map(t => [this.getTriggerKey(t), t]) || []
    );

    // Debug logs removed for cleaner output
    // console.log('From triggers:', Array.from(fromTriggers.keys()));
    // console.log('To triggers:', Array.from(toTriggers.keys()));

    // First, handle removed triggers
    for (const [key, fromTrigger] of fromTriggers) {
      if (!toTriggers.has(key)) {
        steps.push(this.dropTriggerStep(fromModel.name, fromTrigger, schemaName));
      }
    }

    // Then, handle new or modified triggers
    for (const [key, toTrigger] of toTriggers) {
      const fromTrigger = fromTriggers.get(key);
      
      if (!fromTrigger) {
        // New trigger
        steps.push(this.createTriggerStep(toModel.name, toTrigger, schemaName));
      } else if (fromTrigger.execute !== toTrigger.execute) {
        // Modified trigger - first drop, then create
        steps.push(this.dropTriggerStep(toModel.name, fromTrigger, schemaName));
        steps.push(this.createTriggerStep(toModel.name, toTrigger, schemaName));
      }
    }

    return steps;
  }

  private generateCreateTriggerSteps(
    model: Model,
    schemaName: string
  ): MigrationStep[] {
    if (!model.triggers?.length) return [];
    
    return model.triggers.map(trigger => 
      this.createTriggerStep(model.name, trigger, schemaName)
    );
  }

  private generateDropTriggerSteps(
    model: Model,
    schemaName: string
  ): MigrationStep[] {
    if (!model.triggers?.length) return [];
    
    return model.triggers.map(trigger => 
      this.dropTriggerStep(model.name, trigger, schemaName)
    );
  }

  private createTriggerStep(
    tableName: string,
    trigger: Trigger,
    schemaName: string
  ): MigrationStep {
    const triggerName = this.generateTriggerName(tableName, trigger);
    const functionName = `${triggerName}_fn`;
    
    // Create a proper function for the trigger
    const sql = `
      -- Create or replace the trigger function
      CREATE OR REPLACE FUNCTION "${schemaName}"."${functionName}"()
      RETURNS TRIGGER AS $$
      BEGIN
        ${trigger.execute}
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create the trigger
      CREATE TRIGGER ${triggerName}
      ${trigger.event}
      ${trigger.level}
      ON "${schemaName}"."${tableName}"
      EXECUTE FUNCTION "${schemaName}"."${functionName}"();
    `;

    const rollbackSql = `
      -- Drop the trigger
      DROP TRIGGER IF EXISTS ${triggerName} ON "${schemaName}"."${tableName}";
      
      -- Drop the function
      DROP FUNCTION IF EXISTS "${schemaName}"."${functionName}"();
    `;

    return {
      type: 'create',
      objectType: 'trigger',
      name: triggerName,
      sql: sql.trim(),
      rollbackSql: rollbackSql.trim()
    };
  }

  private dropTriggerStep(
    tableName: string,
    trigger: Trigger,
    schemaName: string
  ): MigrationStep {
    const triggerName = this.generateTriggerName(tableName, trigger);
    const functionName = `${triggerName}_fn`;
    
    const sql = `
      -- Drop the trigger
      DROP TRIGGER IF EXISTS ${triggerName} ON "${schemaName}"."${tableName}";
      
      -- Drop the function
      DROP FUNCTION IF EXISTS "${schemaName}"."${functionName}"();
    `;

    // Create function and trigger for rollback
    const rollbackSql = `
      -- Create or replace the trigger function
      CREATE OR REPLACE FUNCTION "${schemaName}"."${functionName}"()
      RETURNS TRIGGER AS $$
      BEGIN
        ${trigger.execute}
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create the trigger
      CREATE TRIGGER ${triggerName}
      ${trigger.event}
      ${trigger.level}
      ON "${schemaName}"."${tableName}"
      EXECUTE FUNCTION "${schemaName}"."${functionName}"();
    `;

    return {
      type: 'drop',
      objectType: 'trigger',
      name: triggerName,
      sql: sql.trim(),
      rollbackSql: rollbackSql.trim()
    };
  }

  private getTriggerKey(trigger: Trigger): string {
    return `${trigger.event}-${trigger.level}-${trigger.execute.replace(/\s+/g, '')}`;
  }

  private generateTriggerName(tableName: string, trigger: Trigger): string {
    const event = trigger.event.toLowerCase().replace(/\s+/g, '_');
    const level = trigger.level.toLowerCase().replace(/\s+/g, '_');
    return `${tableName}_${event}_${level}_trigger`;
  }
} 