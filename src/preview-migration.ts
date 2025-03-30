import { SchemaParser } from './parser/schemaParser';
import { MigrationGenerator } from './migration/migrationGenerator';
import { MigrationWriter } from './migration/migrationWriter';

const parser = new SchemaParser();
const generator = new MigrationGenerator();
const writer = new MigrationWriter('migrations');

// Parse schema and generate migrations
const schema = parser.parseSchema('schema/database.schema');
const migration = generator.generateMigration(schema);
const rollback = generator.generateRollbackMigration(schema);

function printMigration(migration: any, title: string): void {
  console.log(`\n${title}`);
  console.log('='.repeat(title.length));
  console.log(`Version: ${migration.version}`);
  console.log(`Description: ${migration.description}`);
  console.log(`Timestamp: ${migration.timestamp}`);
  
  console.log('\n📝 Steps:');
  migration.steps.forEach((step: any, index: number) => {
    console.log(`\n${index + 1}. ${step.objectType.toUpperCase()}: ${step.name}`);
    console.log('SQL:');
    console.log(step.sql);
    console.log('\nRollback SQL:');
    console.log(step.rollbackSql);
  });
}

// Print migrations
console.log('🔍 Migration Preview');
console.log('==================');
printMigration(migration, 'Up Migration');
printMigration(rollback, 'Down Migration');

// Generate actual migration files
const upMigrationPath = writer.writeMigration(migration);
const downMigrationPath = writer.writeMigration(rollback);

console.log('\n📁 Generated Migration Files:');
console.log('===========================');
console.log(`Up Migration: ${upMigrationPath}`);
console.log(`Down Migration: ${downMigrationPath}`);

// Print some statistics
console.log('\n📊 Migration Statistics:');
console.log('=======================');
console.log(`Total Steps: ${migration.steps.length}`);
console.log(`Extensions: ${migration.steps.filter((step: any) => step.objectType === 'extension').length}`);
console.log(`Enums: ${migration.steps.filter((step: any) => step.objectType === 'enum').length}`);
console.log(`Tables: ${migration.steps.filter((step: any) => step.objectType === 'table').length}`);
console.log(`Constraints: ${migration.steps.filter((step: any) => step.objectType === 'constraint').length}`);
console.log(`Indexes: ${migration.steps.filter((step: any) => step.objectType === 'index').length}`); 