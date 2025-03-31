# Table Orchestrator

The Table Orchestrator is responsible for detecting and managing changes to database tables and fields between schema versions. It provides functionality to:

1. Compare two sets of tables and identify differences (added, removed, updated)
2. Generate migration steps based on those differences

## Architecture

The Table Orchestrator follows a similar pattern to the Extension Orchestrator:

- **Detection:** First, it compares two schemas to detect what has changed
- **Migration Generation:** Then, it generates SQL migration steps for those changes

## Core Components

### TableDiff

This interface represents the differences between two schemas:

```typescript
interface TableDiff {
  added: Model[];           // Tables that exist in the target schema but not in the source
  removed: Model[];         // Tables that exist in the source schema but not in the target
  updated: {                // Tables that exist in both but have differences
    model: Model;
    previousModel: Model;
    fieldsAdded: Field[];
    fieldsRemoved: Field[];
    fieldsUpdated: {
      field: Field;
      previousField: Field;
    }[];
    relationsChanged: boolean;
    rlsChanged: boolean;
    policiesChanged: boolean;
  }[];
}
```

### TableOrchestrator

The main class that handles table/field change detection and migration step generation:

```typescript
class TableOrchestrator {
  // Compare tables between source and target schemas
  compareTables(fromTables: Model[], toTables: Model[]): TableDiff;
  
  // Generate migration steps for table differences
  generateTableMigrationSteps(diff: TableDiff, schemaName?: string): MigrationStep[];
}
```

## Example Usage

```typescript
// Initialize the orchestrator
const tableOrchestrator = new TableOrchestrator();

// Compare tables from source and target schemas
const tableDiff = tableOrchestrator.compareTables(
  sourceSchema.models,
  targetSchema.models
);

// Generate migration steps for the differences
const migrationSteps = tableOrchestrator.generateTableMigrationSteps(tableDiff);
```

## Features

The Table Orchestrator can detect and generate migrations for:

- Added/removed tables
- Added/removed/updated fields (including type changes, default values, etc.)
- Relation changes
- Row-level security (RLS) policy changes

## Integration with Migration Generator

The Table Orchestrator is used by the MigrationGenerator's `generateMigrationFromDiff` method to handle table and field changes when comparing schemas. 