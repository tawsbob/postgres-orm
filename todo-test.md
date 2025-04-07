Comprehensive list of migration tests needed:

Extensions
    - [x] Test installation of pgcrypto, postgis, and uuid-ossp
    - [x] Test version specification (pgcrypto v1.3)
    - [x] Test removal of extensions

Enums
    - [x] Test creation
    - [x] Test modifications (adding new values)
    - [x] Test removal of enum types

Tables/Models
    - [ ] Test creation of all models on the schema
    - [ ] Test table renaming
    - [ ] Test dropping tables
Fields
    - [ ] Test all PostgreSQL data types (UUID, VARCHAR, TEXT, SMALLINT, INTEGER, BOOLEAN, TIMESTAMP, POINT, DECIMAL, JSONB, TEXT[], SERIAL)
    - [ ] Test default values (gen_random_uuid(), now(), literals)
    - [ ] Test constraints (unique, nullable/non-nullable)
    - [ ] Test field addition, modification, and removal
    - [ ] Test changing field types
Row-Level Security
    - [ ] Test enabling RLS on tables
    - [ ] Test force setting for RLS
    - [ ] Test disabling RLS
Policies
    - [ ] Test policy creation with specific privileges
    - [ ] Test policy targeting specific roles
    - [ ] Test complex USING expressions with subqueries
    - [ ] Test policy modification and removal
Roles
    - [ ] Test role creation (userRole, adminRole)
    - [ ] Test privilege assignment
    - [ ] Test role modification and removal
Relations
    - [ ] Test one-to-one relations (User-Profile)
    - [ ] Test one-to-many relations (User-Order, Order-ProductOrder)
    - [ ] Test many-to-many relations (Product-Order via ProductOrder)
    - [ ] Test onDelete/onUpdate behaviors (CASCADE, SET NULL)
    - [ ] Test relation modification
Triggers
    - [ ] Test BEFORE/AFTER triggers on UPDATE
    - [ ] Test trigger PL/pgSQL code execution
    - [ ] Test FOR EACH ROW triggers
    - [ ] Test trigger modification and removal
Indexes
    - [ ] Test btree index creation
    - [ ] Test composite indexes (multiple columns)
    - [ ] Test conditional indexes (WHERE clauses)
    - [ ] Test named indexes
    - [ ] Test unique indexes
    - [ ] Test index modification and removal
Migration Sequences
    - [ ] Test up/down migrations
    - [ ] Test migration rollbacks
    - [ ] Test partial migrations

Edge Cases
    - [ ] Test circular dependencies
    - [ ] Test large schema changes
    - [ ] Test concurrent migrations