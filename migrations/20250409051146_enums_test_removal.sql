-- Migration: enums_test_removal
-- Version: 20250409051146
-- Timestamp: 2025-04-09T05:11:46.048Z

-- Up Migration
BEGIN;

-- enum: OrderStatus
DROP TYPE IF EXISTS "public"."OrderStatus" CASCADE;

COMMIT;

-- Down Migration
BEGIN;

-- enum: OrderStatus
DO $$ BEGIN
  CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'ON_HOLD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;