//import { SchemaParser } from './parser/schemaParser';
import SchemaParserV1 from './parser/schemaParser';

const parser = new SchemaParserV1();
const schema = parser.parseSchema('schema/database.schema');

function printSchema(schema: any, indent: string = ''): void {
  console.log(
    JSON.stringify(schema, null, 2)
  );
  // Print Extensions
  console.log('\n' + indent + '🔌 Extensions:');
  schema.extensions.forEach((extension: any) => {
    const versionInfo = extension.version ? ` (version: ${extension.version})` : '';
    console.log(indent + '  - ' + extension.name + versionInfo);
  });
  
  // Print Enums
  console.log('\n' + indent + '📋 Enums:');
  schema.enums.forEach((enumType: any) => {
    console.log(indent + '  ' + enumType.name + ':');
    console.log(indent + '    Values:', enumType.values.join(', '));
  });

  // Print Roles
  console.log('\n' + indent + '👥 Roles:');
  schema.roles.forEach((role: any) => {
    console.log(indent + '  ' + role.name + ':');
    role.privileges.forEach((privilege: any) => {
      console.log(indent + '    - ' + privilege.privileges.join(', ') + ' on ' + privilege.on);
    });
  });

  // Print Models
  console.log('\n' + indent + '📦 Models:');
  schema.models.forEach((model: any) => {
    console.log(indent + '  ' + model.name + ':');
    
    // Print Fields
    console.log(indent + '    Fields:');
    model.fields.forEach((field: any) => {
      const attributes = field.attributes.length > 0 
        ? ` [${field.attributes.join(', ')}]` 
        : '';
      const defaultValue = field.defaultValue 
        ? ` = ${field.defaultValue}` 
        : '';
      const typeDetails = field.length 
        ? `${field.type}(${field.length}${field.scale ? `,${field.scale}` : ''})` 
        : field.type;
      
      console.log(indent + '      - ' + field.name + ': ' + typeDetails + attributes + defaultValue);
    });

    // Print Relations
    if (model.relations.length > 0) {
      console.log(indent + '    Relations:');
      model.relations.forEach((relation: any) => {
        const relationDetails = relation.fields && relation.references
          ? ` (fields: [${relation.fields.join(', ')}], references: [${relation.references.join(', ')}])`
          : '';
        console.log(indent + '      - ' + relation.name + ': ' + relation.type + ' with ' + relation.model + relationDetails);
      });
    }

    // Print Indexes
    if (model.indexes && model.indexes.length > 0) {
      console.log(indent + '    📇 Indexes:');
      model.indexes.forEach((index: any) => {
        let indexDetails = `fields: [${index.fields.join(', ')}]`;
        
        if (index.name) {
          indexDetails += `, name: "${index.name}"`;
        }
        
        if (index.type) {
          indexDetails += `, type: "${index.type}"`;
        }
        
        if (index.unique !== undefined) {
          indexDetails += `, unique: ${index.unique}`;
        }
        
        if (index.where) {
          indexDetails += `, where: "${index.where}"`;
        }
        
        console.log(indent + '      - ' + indexDetails);
      });
    }

    // Print RLS Configuration
    if (model.rowLevelSecurity) {
      console.log(indent + '    🔒 Row Level Security:');
      console.log(indent + '      - Enabled:', model.rowLevelSecurity.enabled);
      console.log(indent + '      - Force:', model.rowLevelSecurity.force);
    }

    // Print Policies
    if (model.policies && model.policies.length > 0) {
      console.log(indent + '    🛡️ Policies:');
      model.policies.forEach((policy: any) => {
        const forActions = Array.isArray(policy.for) 
          ? policy.for.join(', ') 
          : policy.for;
        console.log(indent + `      - ${policy.name}:`);
        console.log(indent + `        For: ${forActions}`);
        console.log(indent + `        To: ${policy.to}`);
        console.log(indent + `        Using: ${policy.using}`);
      });
    }
    
    // Print Triggers
    if (model.triggers && model.triggers.length > 0) {
      console.log(indent + '    ⚡ Triggers:');
      model.triggers.forEach((trigger: any, index: number) => {
        console.log(indent + `      - Trigger ${index + 1}:`);
        console.log(indent + `        Event: ${trigger.event}`);
        console.log(indent + `        Level: ${trigger.level}`);
        console.log(indent + `        Execute:`);
        
        // Format and print the trigger code
        const codeLines = trigger.execute.split('\n');
        codeLines.forEach((line: string) => {
          console.log(indent + `          ${line}`);
        });
      });
    }
  });
}

console.log('🔍 Schema Preview:');
console.log('=================');
printSchema(schema);

// Print some statistics
console.log('\n📊 Schema Statistics:');
console.log('===================');
console.log(`Total Extensions: ${schema.extensions.length}`);
console.log(`Total Models: ${schema.models.length}`);
console.log(`Total Enums: ${schema.enums.length}`);
console.log(`Total Roles: ${schema.roles.length}`);
console.log(`Total Relations: ${schema.models.reduce((acc: number, model: any) => acc + model.relations.length, 0)}`);
console.log(`Total Policies: ${schema.models.reduce((acc: number, model: any) => acc + (model.policies ? model.policies.length : 0), 0)}`);
console.log(`Total Triggers: ${schema.models.reduce((acc: number, model: any) => acc + (model.triggers ? model.triggers.length : 0), 0)}`); 
console.log(`Total Indexes: ${schema.models.reduce((acc: number, model: any) => acc + (model.indexes ? model.indexes.length : 0), 0)}`); 