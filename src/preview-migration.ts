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
function parseCommandLineArgs(): { schemaPath: string; options: MigrationPreviewOptions; outputPath?: string } {
  const args = process.argv.slice(2);
  let schemaPath = 'schema/database.schema';
  let outputPath: string | undefined;
  
  const options: MigrationPreviewOptions = {
    ...DEFAULT_PREVIEW_OPTIONS
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--schema' || arg === '-s') {
      schemaPath = args[++i] || schemaPath;
    } else if (arg === '--output' || arg === '-o') {
      outputPath = args[++i];
    } else if (arg === '--format' || arg === '-f') {
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
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-') && !schemaPath) {
      // Positional argument for schema path
      schemaPath = arg;
    }
  }
  
  return { schemaPath, options, outputPath };
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Migration Preview Tool
=====================

Usage: npm run preview:migration [options] [schema-path]

Options:
  -s, --schema <path>     Path to schema file (default: schema/database.schema)
  -o, --output <path>     Write output to file instead of console
  -f, --format <format>   Output format: pretty, json, raw (default: pretty)
  
  --no-up                 Don't show up migration
  --no-down               Don't show down migration
  --no-stats              Don't show statistics
  
  --no-extensions         Don't include extensions
  --no-enums              Don't include enums
  --no-tables             Don't include tables
  --no-constraints        Don't include constraints
  --no-indexes            Don't include indexes
  --no-rls                Don't include row level security
  --no-roles              Don't include roles
  
  -h, --help              Show this help information

Examples:
  npm run preview:migration
  npm run preview:migration -- --format json
  npm run preview:migration -- custom-schema.schema --output migration-preview.sql
  npm run preview:migration -- --no-down --no-stats
`);
}

// If this file is run directly
if (require.main === module) {
  const { schemaPath, options, outputPath } = parseCommandLineArgs();
  previewMigration(schemaPath, options, outputPath);
}

// Export the function for use in other modules
export { previewMigration, MigrationPreviewOptions }; 