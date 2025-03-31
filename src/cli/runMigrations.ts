#!/usr/bin/env node
import path from 'path';
import { config } from 'dotenv';
import { PostgresMigrationRunner } from '../migration/runner';
import fs from 'fs';
import inquirer from 'inquirer';
import SchemaParserV1 from '../parser/schemaParser';
import { MigrationGenerator } from '../migration/migrationGenerator';
import { migrationToRawSql } from '../migration/previewHelpers';

// Load environment variables from .env file
config();

interface CliOptions {
  command: 'up' | 'down' | 'status' | 'generate';
  migrationsDir: string;
  connectionString?: string;
  schemaName?: string;
  migrationsTableName?: string;
  steps?: number;
  toVersion?: string;
  dryRun?: boolean;
  schemaPath?: string;
  name?: string;
  outputPath?: string;
}

/**
 * Converts a string to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const command = args[0] as 'up' | 'down' | 'status' | 'generate';
  
  if (!command || !['up', 'down', 'status', 'generate'].includes(command)) {
    printUsage();
    process.exit(1);
  }
  
  const options: CliOptions = {
    command,
    migrationsDir: process.env.MIGRATIONS_DIR || path.join(process.cwd(), 'migrations'),
  };
  
  // Parse command-line arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--dir' && i + 1 < args.length) {
      options.migrationsDir = args[++i];
    } else if (arg === '--connection-string' && i + 1 < args.length) {
      options.connectionString = args[++i];
    } else if (arg === '--schema' && i + 1 < args.length) {
      options.schemaName = args[++i];
    } else if (arg === '--table' && i + 1 < args.length) {
      options.migrationsTableName = args[++i];
    } else if (arg === '--steps' && i + 1 < args.length) {
      options.steps = parseInt(args[++i], 10);
    } else if (arg === '--to-version' && i + 1 < args.length) {
      options.toVersion = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--schema-path' && i + 1 < args.length) {
      options.schemaPath = args[++i];
    } else if (arg === '--name' && i + 1 < args.length) {
      options.name = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      options.outputPath = args[++i];
    } else if (arg === '--help') {
      printUsage();
      process.exit(0);
    }
  }
  
  return options;
}

function printUsage() {
  console.log(`
Usage: migrate <command> [options]

Commands:
  up        Run pending migrations
  down      Rollback migrations
  status    Show migration status
  generate  Generate migration from schema

Options:
  --dir <path>              Migrations directory (default: ./migrations)
  --connection-string <url> Database connection string (default: env.DATABASE_URL)
  --schema <n>              Database schema (default: public)
  --table <n>               Migrations table name (default: schema_migrations)
  --steps <number>          Number of migrations to roll back (down only)
  --to-version <version>    Roll back to specific version (down only)
  --dry-run                 Show what would be executed without making changes
  --schema-path <path>      Path to schema file (generate only, default: schema/database.schema)
  --name <name>             Migration name (generate only)
  --output <path>           Output path (generate only, default: <migrations_dir>/<timestamp>_<name>.sql)
  --help                    Show this help message
  `);
}

async function main() {
  const options = parseArgs();
  
  if (options.command === 'generate') {
    try {
      const schemaPath = options.schemaPath || 'schema/database.schema';
      
      // If no name was provided, prompt for it
      let migrationName = options.name || '';
      if (!migrationName) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for this migration:',
            default: 'migration',
            validate: (input) => {
              return input.trim() !== '' ? true : 'Migration name cannot be empty';
            }
          }
        ]);
        migrationName = answers.name;
      }
      
      // Convert name to snake_case for the filename
      const snakeCaseName = toSnakeCase(migrationName);
      
      // Parse the schema
      const parser = new SchemaParserV1();
      const schema = parser.parseSchema(schemaPath);
      
      // Generate the migration
      const migrationGenerator = new MigrationGenerator();
      const migration = migrationGenerator.generateMigration(schema, {
        schemaName: options.schemaName || 'public',
      });

      // Use the provided name for the migration description
      migration.description = migrationName;
      
      // Convert to SQL
      const sql = migrationToRawSql(migration);
      
      // Determine output path
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const filename = `${timestamp}_${snakeCaseName}.sql`;
      const outputPath = options.outputPath || path.join(options.migrationsDir, filename);
      
      // Ensure migrations directory exists
      if (!fs.existsSync(options.migrationsDir)) {
        fs.mkdirSync(options.migrationsDir, { recursive: true });
      }
      
      // Write the migration file
      fs.writeFileSync(outputPath, sql);
      
      console.log(`✅ Migration generated successfully at ${outputPath}`);
      console.log(`Migration version: ${migration.version}`);
      console.log(`Migration contains ${migration.steps.length} steps`);
      
      return;
    } catch (error) {
      console.error('Error generating migration:', error);
      process.exit(1);
    }
  }
  
  const runner = new PostgresMigrationRunner({
    connectionString: options.connectionString || process.env.DATABASE_URL,
    migrationsDir: options.migrationsDir,
    schemaName: options.schemaName,
    migrationsTableName: options.migrationsTableName,
  });
  
  try {
    console.log('Initializing migration runner...');
    await runner.init();
    
    switch (options.command) {
      case 'up': {
        console.log('Running migrations...');
        const result = await runner.runMigrations({
          dryRun: options.dryRun,
        });
        
        if (result.success) {
          if (result.appliedMigrations.length === 0) {
            console.log('No migrations to apply.');
          } else {
            console.log('Successfully applied migrations:');
            result.appliedMigrations.forEach(v => console.log(`  - ${v}`));
          }
        } else {
          console.error('Error applying migrations:', result.error);
          process.exit(1);
        }
        break;
      }
      
      case 'down': {
        console.log('Rolling back migrations...');
        const result = await runner.rollback({
          steps: options.steps,
          toVersion: options.toVersion,
          dryRun: options.dryRun,
        });
        
        if (result.success) {
          if (result.rolledBackMigrations.length === 0) {
            console.log('No migrations to roll back.');
          } else {
            console.log('Successfully rolled back migrations:');
            result.rolledBackMigrations.forEach(v => console.log(`  - ${v}`));
          }
        } else {
          console.error('Error rolling back migrations:', result.error);
          process.exit(1);
        }
        break;
      }
      
      case 'status': {
        const { applied, pending } = await runner.getMigrationsStatus();
        
        console.log('\nApplied migrations:');
        if (applied.length === 0) {
          console.log('  None');
        } else {
          applied.forEach(m => {
            console.log(`  - ${m.version}: ${m.name} (applied at ${new Date(m.applied_at).toLocaleString()})`);
          });
        }
        
        console.log('\nPending migrations:');
        if (pending.length === 0) {
          console.log('  None');
        } else {
          pending.forEach(m => {
            console.log(`  - ${m.version}: ${m.description}`);
          });
        }
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 