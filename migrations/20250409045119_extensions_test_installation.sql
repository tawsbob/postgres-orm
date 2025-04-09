-- Migration: extensions_test_installation
-- Version: 20250409045119
-- Timestamp: 2025-04-09T04:51:19.028Z

-- Up Migration
BEGIN;

-- extension: pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto" VERSION '1.3';

-- extension: postgis
CREATE EXTENSION IF NOT EXISTS "postgis";

-- extension: uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

COMMIT;

-- Down Migration
BEGIN;

-- extension: uuid-ossp
DROP EXTENSION IF EXISTS "uuid-ossp";

-- extension: postgis
DROP EXTENSION IF EXISTS "postgis";

-- extension: pgcrypto
DROP EXTENSION IF EXISTS "pgcrypto";

COMMIT;