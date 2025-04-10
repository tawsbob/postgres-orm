# PostgreSQL ORM Migration Test Plan

This document outlines the comprehensive test coverage required for PostgreSQL migration functionality.

## Test Categories

### Extensions
- [x] Test installation of pgcrypto, postgis, and uuid-ossp
- [x] Test version specification (pgcrypto v1.3)
- [x] Test removal of extensions

### Enums
- [x] Test creation
- [x] Test modifications (adding new values)
- [x] Test removal of enum types

### Tables/Models
- [x] Test creation of all models on the schema
- [x] Test table renaming
- [x] Test dropping tables

### Fields
- [x] Test all PostgreSQL data types (UUID, VARCHAR, TEXT, SMALLINT, INTEGER, BOOLEAN, TIMESTAMP, POINT, DECIMAL, JSONB, TEXT[], SERIAL)
- [x] Test default values (gen_random_uuid(), now(), literals)
- [x] Test constraints (unique, nullable/non-nullable)
- [x] Test field addition, modification, and removal 

### Row-Level Security
- [x] Test enabling RLS on tables
- [x] Test force setting for RLS
- [x] Test disabling RLS

### Policies
- [x] Test policy creation with specific privileges
- [x] Test policy targeting specific roles
- [x] Test complex USING expressions with subqueries
- [x] Test policy modification and removal

### Roles
- [x] Test role creation (userRole, adminRole)
- [x] Test privilege assignment
- [x] Test role modification and removal

### Relations
- [x] Test one-to-one relations (User-Profile)
- [x] Test one-to-many relations (User-Order, Order-ProductOrder)
- [x] Test many-to-many relations (Product-Order via ProductOrder)
- [x] Test onDelete/onUpdate behaviors (CASCADE, SET NULL)
- [x] Test relation modification and removal

### Triggers
- [x] Test BEFORE/AFTER triggers on UPDATE
- [x] Test trigger PL/pgSQL code execution
- [x] Test FOR EACH ROW triggers
- [x] Test trigger modification and removal

### Indexes
- [x] Test btree index creation
- [x] Test composite indexes (multiple columns)
- [x] Test conditional indexes (WHERE clauses)
- [x] Test named indexes
- [x] Test unique indexes
- [x] Test index modification and removal

### Migration Sequences
- [ ] Test up/down migrations
- [ ] Test migration rollbacks
- [ ] Test partial migrations

### Edge Cases
- [ ] Test circular dependencies
- [ ] Test large schema changes
- [ ] Test concurrent migrations