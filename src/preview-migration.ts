import { Schema } from './parser/types';
import SchemaParserV1 from './parser/schemaParser';
import { MigrationGenerator } from './migration/migrationGenerator';
import { Migration, MigrationOptions } from './migration/types';
import { 
  MigrationPreviewOptions, 
  DEFAULT_PREVIEW_OPTIONS,
  formatMigrationForPreview,
  migrationToJson,
  migrationToRawSql
} from './migration/previewHelpers';
import fs from 'fs';
import path from 'path';

/**
 * Helper function to print migration SQL in a structured way
 */
function printMigrationSQL(migration: Migration): void {
  console.log('\n🚀 Migration Preview:');
  console.log('==================');
  console.log(`Version: ${migration.version}`);
  console.log(`Description: ${migration.description}`);
  console.log(`Timestamp: ${migration.timestamp}`);
  
  console.log('\n⬆️ Up Migration:');
  console.log('---------------');
  
  const sortedSteps = [...migration.steps].sort((a, b) => {
    // Extensions first
    if (a.objectType === 'extension' && b.objectType !== 'extension') return -1;
    if (a.objectType !== 'extension' && b.objectType === 'extension') return 1;
    // Then enums
    if (a.objectType === 'enum' && b.objectType !== 'enum') return -1;
    if (a.objectType !== 'enum' && b.objectType === 'enum') return 1;
    return 0;
  });
  
  sortedSteps.forEach((step, index) => {
    console.log(`\n--- Step ${index + 1}: ${step.type} ${step.objectType} '${step.name}' ---`);
    console.log(step.sql);
  });
  
  console.log('\n⬇️ Down Migration:');
  console.log('----------------');
  
  const reverseSortedSteps = [...migration.steps].reverse().sort((a, b) => {
    // Tables last (they should be dropped after their constraints)
    if (a.objectType === 'table' && b.objectType !== 'table') return 1;
    if (a.objectType !== 'table' && b.objectType === 'table') return -1;
    // Then enums
    if (a.objectType === 'enum' && b.objectType !== 'enum') return -1;
    if (a.objectType !== 'enum' && b.objectType === 'enum') return 1;
    // Then extensions
    if (a.objectType === 'extension' && b.objectType !== 'extension') return -1;
    if (a.objectType !== 'extension' && b.objectType === 'extension') return 1;
    return 0;
  });
  
  reverseSortedSteps.forEach((step, index) => {
    console.log(`\n--- Step ${index + 1}: drop ${step.objectType} '${step.name}' ---`);
    console.log(step.rollbackSql);
  });
}

/**
 * Helper function to print migration statistics
 */
function printMigrationStats(migration: Migration): void {
  console.log('\n📊 Migration Statistics:');
  console.log('=====================');
  
  const objectTypes = new Set(migration.steps.map(step => step.objectType));
  const stepsByType = {} as Record<string, number>;
  
  migration.steps.forEach(step => {
    if (!stepsByType[step.objectType]) {
      stepsByType[step.objectType] = 0;
    }
    stepsByType[step.objectType]++;
  });
  
  console.log(`Total Steps: ${migration.steps.length}`);
  
  for (const [type, count] of Object.entries(stepsByType)) {
    console.log(`- ${type}: ${count}`);
  }
}

/**
 * Main function to preview the migration
 */
function previewMigration(
  schemaPath: string = 'schema/database.schema',
  options: MigrationPreviewOptions = DEFAULT_PREVIEW_OPTIONS,
  outputPath?: string
): void {
  try {
    // Parse the schema
    const parser = new SchemaParserV1();
    const schema = parser.parseSchema(schemaPath);
    
    // Generate the migration
    const migrationGenerator = new MigrationGenerator();
    const migration = migrationGenerator.generateMigration(schema, options);
    
    // Format the output based on the requested format
    let output: string;
    
    switch (options.format) {
      case 'json':
        output = migrationToJson(migration);
        break;
      case 'raw':
        output = migrationToRawSql(migration);
        break;
      case 'pretty':
      default:
        output = formatMigrationForPreview(migration, options);
        break;
    }
    
    // Either output to console or write to a file
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, output);
      console.log(`✅ Migration preview written to ${outputPath}`);
    } else {
      console.log(output);
      console.log('\n✅ Migration preview generated successfully.');
    }
  } catch (error) {
    console.error('❌ Error generating migration preview:', error);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseCommandLineArgs(): { 
  schemaPath: string; 
  fromSchemaPath?: string;
  options: MigrationPreviewOptions; 
  outputPath?: string;
  isComparison: boolean;
} {
  const args = process.argv.slice(2);
  let schemaPath = 'schema/database.schema';
  let fromSchemaPath: string | undefined;
  let outputPath: string | undefined;
  let isComparison = false;
  
  const options: MigrationPreviewOptions = {
    ...DEFAULT_PREVIEW_OPTIONS
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--schema' || arg === '-s') {
      schemaPath = args[++i] || schemaPath;
    } else if (arg === '--from-schema' || arg === '-f') {
      fromSchemaPath = args[++i];
      isComparison = true;
    } else if (arg === '--output' || arg === '-o') {
      outputPath = args[++i];
    } else if (arg === '--format') {
      const format = args[++i];
      if (['pretty', 'json', 'raw'].includes(format)) {
        options.format = format as 'pretty' | 'json' | 'raw';
      } else {
        console.warn(`Warning: Invalid format '${format}'. Using default format 'pretty'.`);
      }
    } else if (arg === '--no-up') {
      options.showUpMigration = false;
    } else if (arg === '--no-down') {
      options.showDownMigration = false;
    } else if (arg === '--no-stats') {
      options.showStats = false;
    } else if (arg === '--no-extensions') {
      options.includeExtensions = false;
    } else if (arg === '--no-enums') {
      options.includeEnums = false;
    } else if (arg === '--no-tables') {
      options.includeTables = false;
    } else if (arg === '--no-constraints') {
      options.includeConstraints = false;
    } else if (arg === '--no-indexes') {
      options.includeIndexes = false;
    } else if (arg === '--no-rls') {
      options.includeRLS = false;
    } else if (arg === '--no-roles') {
      options.includeRoles = false;
    } else if (arg === '--no-policies') {
      options.includePolicies = false;
    } else if (arg === '--no-triggers') {
      options.includeTriggers = false;
    } else if (arg === '--no-relations') {
      options.includeRelations = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-') && !schemaPath) {
      // Positional argument for schema path
      schemaPath = arg;
    }
  }
  
  return { schemaPath, fromSchemaPath, options, outputPath, isComparison };
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Usage: npx preview-migration [options] [schema-path]

Options:
  --schema, -s <path>       Path to the schema file (default: schema/database.schema)
  --from-schema, -f <path>  Path to the source schema file for comparison
  --output, -o <path>       Path to save the migration output
  --format <format>         Output format: pretty, json, raw (default: pretty)
  --no-up                   Don't show up migration
  --no-down                 Don't show down migration
  --no-stats                Don't show migration statistics
  --no-extensions           Don't include extensions in migration
  --no-enums                Don't include enums in migration
  --no-tables               Don't include tables in migration
  --no-constraints          Don't include constraints in migration
  --no-indexes              Don't include indexes in migration
  --no-rls                  Don't include row level security in migration
  --no-roles                Don't include roles in migration
  --no-policies             Don't include policies in migration
  --no-triggers             Don't include triggers in migration
  --no-relations            Don't include relations in migration
  --help, -h                Show this help

Examples:
  npx preview-migration
  npx preview-migration schema/database.schema
  npx preview-migration --from-schema schema/current.schema --schema schema/new.schema
  npx preview-migration --output migration.sql --format raw
  npx preview-migration --no-extensions --no-enums
`);
}

// Main execution
try {
  const { schemaPath, fromSchemaPath, options, outputPath, isComparison } = parseCommandLineArgs();
  
  console.log(`Reading schema from ${schemaPath}...`);
  
  // Read schema file
  const parser = new SchemaParserV1();
  const targetSchema = parser.parseSchema(schemaPath);
  
  let migration: Migration;
  
  if (isComparison && fromSchemaPath) {
    console.log(`Comparing with schema from ${fromSchemaPath}...`);
    const sourceSchema = parser.parseSchema(fromSchemaPath);
    
    // Generate migration using comparison logic
    const generator = new MigrationGenerator();
    migration = generator.generateMigrationFromDiff(sourceSchema, targetSchema, {
      includeExtensions: options.includeExtensions,
      includeEnums: options.includeEnums,
      includeTables: options.includeTables,
      includeConstraints: options.includeConstraints,
      includeIndexes: options.includeIndexes,
      includeRLS: options.includeRLS,
      includeRoles: options.includeRoles,
      includePolicies: options.includePolicies,
      includeTriggers: options.includeTriggers,
      includeRelations: options.includeRelations
    });
  } else {
    // Generate migration from single schema (traditional approach)
    const generator = new MigrationGenerator();
    migration = generator.generateMigration(targetSchema, {
      includeExtensions: options.includeExtensions,
      includeEnums: options.includeEnums,
      includeTables: options.includeTables,
      includeConstraints: options.includeConstraints,
      includeIndexes: options.includeIndexes,
      includeRLS: options.includeRLS,
      includeRoles: options.includeRoles,
      includePolicies: options.includePolicies,
      includeTriggers: options.includeTriggers,
      includeRelations: options.includeRelations
    });
  }

  // Format migration output
  let output: string;
  switch (options.format) {
    case 'json':
      output = migrationToJson(migration);
      break;
    case 'raw':
      output = migrationToRawSql(migration);
      break;
    case 'pretty':
    default:
      output = formatMigrationForPreview(migration, options);
      break;
  }

  // Output or save
  if (outputPath) {
    fs.writeFileSync(outputPath, output);
    console.log(`Migration saved to ${outputPath}`);
  } else {
    console.log(output);
  }

} catch (error) {
  console.error('Error:', (error as Error).message);
  process.exit(1);
}

// Export the function for use in other modules
export { previewMigration, MigrationPreviewOptions }; 