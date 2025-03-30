import SchemaParserV1 from './schemaParser';
import fs from 'fs';
import path from 'path';

/**
 * Simple utility to parse and output a schema
 */
function parseAndOutput(schemaPath: string): void {
  try {
    const parser = new SchemaParserV1();
    const schema = parser.parseSchema(schemaPath);
    
    console.log('Schema parsed successfully!');
    console.log(`Found ${schema.models.length} models, ${schema.enums.length} enums, ${schema.extensions.length} extensions, and ${schema.roles.length} roles.`);
    
    // Log detailed information about the schema
    console.log('\nModels:');
    schema.models.forEach(model => {
      console.log(`- ${model.name}`);
      
      console.log('  Fields:');
      model.fields.forEach(field => {
        let fieldStr = `    ${field.name}: ${field.type}`;
        
        if (field.length) fieldStr += `(${field.length})`;
        else if (field.precision && field.scale) fieldStr += `(${field.precision},${field.scale})`;
        
        if (field.attributes.length) {
          fieldStr += ` @${field.attributes.join(' @')}`;
        }
        
        if (field.defaultValue) {
          fieldStr += ` = ${field.defaultValue}`;
        }
        
        console.log(fieldStr);
      });
      
      if (model.relations.length) {
        console.log('  Relations:');
        model.relations.forEach(relation => {
          console.log(`    ${relation.name}: ${relation.model} (${relation.type})`);
        });
      }
      
      if (model.policies && model.policies.length) {
        console.log('  Policies:');
        model.policies.forEach(policy => {
          console.log(`    ${policy.name}`);
        });
      }
    });
    
    console.log('\nEnums:');
    schema.enums.forEach(enumDef => {
      console.log(`- ${enumDef.name}: ${enumDef.values.join(', ')}`);
    });
    
    console.log('\nExtensions:');
    schema.extensions.forEach(ext => {
      console.log(`- ${ext.name}`);
    });
    
    console.log('\nRoles:');
    schema.roles.forEach(role => {
      console.log(`- ${role.name}`);
    });
    
  } catch (error) {
    console.error('Error parsing schema:');
    console.error(error);
  }
}

// Check if being run directly
if (require.main === module) {
  const schemaPath = process.argv[2] || path.resolve(__dirname, '../../schema/database.schema');
  console.log(`Parsing schema at: ${schemaPath}`);
  parseAndOutput(schemaPath);
}

export default parseAndOutput; 