# PostgreSQL Policy Orchestrator

The Policy Orchestrator is a component responsible for managing PostgreSQL Row-Level Security (RLS) policy changes between schema versions. It provides a systematic approach to comparing policy configurations, detecting changes, and generating appropriate migration steps.

## Overview

PostgreSQL's Row-Level Security policies control which rows users can view or modify in a table. Unlike many database objects, policies cannot be altered directly - they must be dropped and recreated when changes are needed. The Policy Orchestrator handles this complexity transparently.

## Key Features

1. **Policy Comparison**: Detect added, removed, and updated policies between two schema versions
2. **Intelligent SQL Generation**: Generate appropriate SQL commands for policy migrations
3. **Automatic Drop & Recreate**: Handle the PostgreSQL requirement of dropping and recreating policies when updates are needed
4. **Rollback Support**: Generate appropriate rollback SQL for all policy changes

## Usage

The Policy Orchestrator works alongside the RLS Orchestrator and integrates with the main Migration Generator.

```typescript
import { PolicyOrchestrator } from 'postgres-orm';

// Create a new instance
const orchestrator = new PolicyOrchestrator();

// Compare policies between two schema versions
const diff = orchestrator.comparePolicies(fromModels, toModels);

// Generate migration steps from the differences
const steps = orchestrator.generatePolicyMigrationSteps(diff, 'public');
```

## Policy Comparison

The `comparePolicies` method analyzes two sets of models to identify policy changes:

```typescript
const diff = orchestrator.comparePolicies(fromModels, toModels);
```

This returns a `PolicyDiff` object with three collections:
- `added`: Policies that exist in the target but not the source
- `removed`: Policies that exist in the source but not the target
- `updated`: Policies that exist in both but have changed settings

## Migration Step Generation

The `generatePolicyMigrationSteps` method creates migration steps based on the policy differences:

```typescript
const steps = orchestrator.generatePolicyMigrationSteps(diff, 'schemaName');
```

For each policy change, it generates the appropriate SQL commands needed to implement the change, along with rollback SQL.

## Examples

### Adding a New Policy

When a policy is added to a table:

```typescript
// Source model (no policies)
const userModel = {
  name: 'users',
  fields: [...],
  relations: [],
  rowLevelSecurity: {
    enabled: true,
    force: true
  }
};

// Target model (with policy)
const userModelWithPolicy = {
  ...userModel,
  policies: [{
    name: 'users_select_policy',
    for: ['select'],
    to: 'authenticated',
    using: '(user_id = auth.uid())'
  }]
};

// Generate migration
const diff = orchestrator.comparePolicies([userModel], [userModelWithPolicy]);
const steps = orchestrator.generatePolicyMigrationSteps(diff);

// Result: Steps to create the new policy
```

### Adding a Policy with Check Clause

When adding a policy with a check clause for data validation:

```typescript
// Source model (no policies)
const userModel = {
  name: 'users',
  fields: [...],
  relations: [],
  rowLevelSecurity: {
    enabled: true,
    force: true
  }
};

// Target model (with policy including check clause)
const userModelWithCheckPolicy = {
  ...userModel,
  policies: [{
    name: 'users_update_policy',
    for: ['update'],
    to: 'authenticated',
    using: '(user_id = auth.uid())',
    check: '(role = current_role AND email = OLD.email)'
  }]
};

// Generate migration
const diff = orchestrator.comparePolicies([userModel], [userModelWithCheckPolicy]);
const steps = orchestrator.generatePolicyMigrationSteps(diff);

// Result: Steps to create the new policy with a CHECK clause
```

### Updating an Existing Policy

When a policy definition changes:

```typescript
// Source model 
const modelWithPolicy = {
  name: 'posts',
  fields: [...],
  policies: [{
    name: 'posts_policy',
    for: ['select'],
    to: 'authenticated',
    using: '(author_id = auth.uid())'
  }]
};

// Target model (policy updated)
const modelWithUpdatedPolicy = {
  ...modelWithPolicy,
  policies: [{
    name: 'posts_policy',
    for: ['select', 'update'], // Added update permission
    to: 'authenticated',
    using: '(author_id = auth.uid())',
    check: '(is_draft = false)' // Added check clause for updates
  }]
};

// Generate migration
const diff = orchestrator.comparePolicies([modelWithPolicy], [modelWithUpdatedPolicy]);
const steps = orchestrator.generatePolicyMigrationSteps(diff);

// Result: Steps to drop the old policy and create the new policy with check clause
```

## Testing

Run the policy orchestrator tests with:

```bash
npm run test:policy:all
```

Individual test suites can be run with:

```bash
npm run test:policy:orchestrator    # Unit tests
npm run test:policy:integration     # Integration tests
``` 