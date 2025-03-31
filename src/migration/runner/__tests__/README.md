# Migration Integration Tests

This directory contains integration tests for the migration system that verify functionality from schema parsing to SQL generation, migration application, and rollback.

## Test Overview

The integration tests verify:

1. Generating migrations from the database schema
2. Applying migrations to a real PostgreSQL database
3. Verifying migration status
4. Rolling back migrations
5. Testing dry run mode for both apply and rollback operations

## Running Tests

### Prerequisites

- Node.js and npm installed
- Docker installed (for isolated testing)

### Running with Docker (Recommended)

The simplest way to run these tests is using the provided shell script, which creates a temporary PostgreSQL container:

```bash
# Make the script executable
chmod +x src/migration/runner/__tests__/runIntegrationTests.sh

# Run tests
./src/migration/runner/__tests__/runIntegrationTests.sh
```

This script:
- Creates a temporary PostgreSQL container
- Configures the test environment
- Runs the integration tests
- Cleans up the container when done

### Running Against an Existing Database

If you prefer to run against an existing PostgreSQL instance:

1. Set the environment variable for your test database (DO NOT use a production database):

```bash
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/test_database"
```

2. Run the tests:

```bash
npx jest src/migration/runner/__tests__/integrationTests.test.ts
```

## Test Structure

The integration tests verify the full lifecycle of migrations:

1. **Test Setup**: Creates a temporary directory for migrations and initializes the database connection
2. **Migration Generation**: Parses the database schema and generates a migration
3. **Migration Application**: Applies the migration to the database and verifies success
4. **Status Verification**: Checks that the migration is properly tracked in the database
5. **Migration Rollback**: Reverses the migration and verifies success
6. **Dry Run Testing**: Verifies that dry run mode reports changes without actually applying them

## Adding New Tests

When adding new integration tests, follow these guidelines:

1. Keep tests isolated and idempotent
2. Always clean up after tests
3. Use descriptive test names that explain what functionality is being tested
4. Consider edge cases and failure scenarios 