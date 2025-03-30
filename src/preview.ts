import { SchemaParser } from './parser/schemaParser';

const parser = new SchemaParser();
const schema = parser.parseSchema('schema/database.schema');

function printSchema(schema: any, indent: string = ''): void {

  console.log(
    JSON.stringify(schema, null, 2)
  );

  // Print Enums
  console.log('\n' + indent + '📋 Enums:');
  schema.enums.forEach((enumType: any) => {
    console.log(indent + '  ' + enumType.name + ':');
    console.log(indent + '    Values:', enumType.values.join(', '));
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
  });
}

console.log('🔍 Schema Preview:');
console.log('=================');
printSchema(schema);

// Print some statistics
console.log('\n📊 Schema Statistics:');
console.log('===================');
console.log(`Total Models: ${schema.models.length}`);
console.log(`Total Enums: ${schema.enums.length}`);
console.log(`Total Relations: ${schema.models.reduce((acc: number, model: any) => acc + model.relations.length, 0)}`); 