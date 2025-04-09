-- Migration: enums_test_modifications
-- Version: 20250409045332
-- Timestamp: 2025-04-09T04:53:32.767Z

-- Up Migration
BEGIN;

-- enum: UserRole_drop
DROP TYPE IF EXISTS "public"."UserRole" CASCADE;

-- enum: UserRole
DO $$ BEGIN
  CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER', 'PUBLIC', 'GUEST', 'MODERATOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- enum: OrderStatus_drop
DROP TYPE IF EXISTS "public"."OrderStatus" CASCADE;

-- enum: OrderStatus
DO $$ BEGIN
  CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'ON_HOLD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

-- Down Migration
BEGIN;

-- enum: OrderStatus
DROP TYPE IF EXISTS "public"."OrderStatus" CASCADE;

-- enum: OrderStatus_drop
DO $$ BEGIN
  CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- enum: UserRole
DROP TYPE IF EXISTS "public"."UserRole" CASCADE;

-- enum: UserRole_drop
DO $$ BEGIN
  CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER', 'PUBLIC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;