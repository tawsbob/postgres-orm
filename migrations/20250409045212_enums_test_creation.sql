-- Migration: enums_test_creation
-- Version: 20250409045212
-- Timestamp: 2025-04-09T04:52:12.279Z

-- Up Migration
BEGIN;

-- enum: UserRole
DO $$ BEGIN
  CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER', 'PUBLIC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- enum: OrderStatus
DO $$ BEGIN
  CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- Down Migration
BEGIN;

-- enum: OrderStatus
DROP TYPE IF EXISTS "public"."OrderStatus" CASCADE;

-- enum: UserRole
DROP TYPE IF EXISTS "public"."UserRole" CASCADE;

COMMIT;