-- Migration: tables_test_table_renaming
-- Version: 20250409055042
-- Timestamp: 2025-04-09T05:50:42.785Z

-- Up Migration
BEGIN;

-- table: Cart
DO $$ BEGIN
  CREATE TABLE "public"."Cart" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now() NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- table: ProductOrder
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."ProductOrder" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."ProductOrder" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."ProductOrder" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

COMMIT;

-- Down Migration
BEGIN;

-- table: ProductOrder
DO $$ BEGIN
  CREATE TABLE "public"."ProductOrder" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now() NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- table: Cart
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."Cart" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."Cart" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."Cart" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

COMMIT;