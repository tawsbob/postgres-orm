import { SchemaParser } from './parser/schemaParser';

const parser = new SchemaParser();
const schema = parser.parseSchema('schema/database.schema');

// Example: Print all models and their fields
console.log('Schema Models:');
schema.models.forEach(model => {
  console.log(`\nModel: ${model.name}`);
  console.log('Fields:');
  model.fields.forEach(field => {
    console.log(`  - ${field.name}: ${field.type} ${field.attributes.join(' ')}`);
  });
  console.log('Relations:');
  model.relations.forEach(relation => {
    console.log(`  - ${relation.name}: ${relation.type} with ${relation.model}`);
  });
});

// Example: Print all enums
console.log('\nSchema Enums:');
schema.enums.forEach(enumType => {
  console.log(`\nEnum: ${enumType.name}`);
  console.log('Values:', enumType.values.join(', '));
}); 