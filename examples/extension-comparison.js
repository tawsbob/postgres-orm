/**
 * Example script that demonstrates the Extension Orchestrator functionality
 * 
 * This example:
 * 1. Creates two sample schema files with different extensions
 * 2. Uses the extension orchestrator to generate a migration
 * 3. Prints the resulting migration
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Create example directory if it doesn't exist
const exampleDir = path.join(__dirname, 'temp');
if (!fs.existsSync(exampleDir)) {
  fs.mkdirSync(exampleDir, { recursive: true });
}

// Source schema with basic extensions
const sourceSchemaContent = `
// Define a couple of basic extensions
extension pg_trgm
extension hstore(version='1.4')

// Define a sample model
model User {
  id UUID @id @default(gen_random_uuid())
  name VARCHAR(100)
  email VARCHAR(255) @unique
}
`;

// Target schema with changed extensions
const targetSchemaContent = `
// Keep pg_trgm but update hstore and add a new extension
extension pg_trgm
extension hstore(version='1.5')
extension uuid-ossp

// Define a sample model
model User {
  id UUID @id @default(gen_random_uuid())
  name VARCHAR(100)
  email VARCHAR(255) @unique
}
`;

// Write sample schemas to files
const sourceSchemaPath = path.join(exampleDir, 'source.schema');
const targetSchemaPath = path.join(exampleDir, 'target.schema');

fs.writeFileSync(sourceSchemaPath, sourceSchemaContent);
fs.writeFileSync(targetSchemaPath, targetSchemaContent);

console.log('Example schema files created:');
console.log('- Source Schema:', sourceSchemaPath);
console.log('- Target Schema:', targetSchemaPath);
console.log('\nRunning extension comparison...\n');

// Run the migration comparison
const command = `ts-node ../src/preview-migration.ts --from-schema ${sourceSchemaPath} --schema ${targetSchemaPath} --no-enums --no-tables`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  
  console.log(stdout);
  console.log('\nExtension orchestrator demonstration complete!');
  console.log('The migration preview above shows the required steps to:');
  console.log('1. Update the hstore extension from version 1.4 to 1.5');
  console.log('2. Add the new uuid-ossp extension');
}); 