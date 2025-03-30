-- Migration: Initial schema migration
-- Version: 20250330174151
-- Timestamp: 2025-03-30T17:41:51.032Z

-- Up Migration
BEGIN;

-- extension: pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- extension: postgis
CREATE EXTENSION IF NOT EXISTS "postgis";

-- extension: uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- enum: UserRole
DO $$ BEGIN
  CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER', 'GUEST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- enum: OrderStatus
DO $$ BEGIN
  CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- table: User
CREATE TABLE "public"."User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) UNIQUE,
  "name" VARCHAR(100),
  "role" "public"."UserRole" DEFAULT 'USER'::"public"."UserRole",
  "age" SMALLINT,
  "balance" DECIMAL(10,2),
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP,
  "preferences" JSONB
);

-- table: Profile
CREATE TABLE "public"."Profile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID UNIQUE,
  "bio" TEXT,
  "avatar" VARCHAR(255),
  "location" POINT
);

-- table: Order
CREATE TABLE "public"."Order" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID,
  "status" "public"."OrderStatus" DEFAULT 'PENDING'::"public"."OrderStatus",
  "totalAmount" DECIMAL(10,2),
  "items" JSONB,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP
);

-- table: Product
CREATE TABLE "public"."Product" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "description" TEXT,
  "price" DECIMAL(10,2),
  "stock" INTEGER,
  "category" VARCHAR(100),
  "metadata" JSONB,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP
);

-- table: ProductOrder
CREATE TABLE "public"."ProductOrder" (
  "id" SERIAL PRIMARY KEY,
  "orderId" UUID,
  "productId" UUID,
  "quantity" INTEGER,
  "price" DECIMAL(10,2)
);

-- index: idx_User_email
CREATE UNIQUE INDEX "idx_User_email"
ON "public"."User" ("email");

-- index: idx_Profile_userId
CREATE UNIQUE INDEX "idx_Profile_userId"
ON "public"."Profile" ("userId");

-- constraint: fk_Profile_user
ALTER TABLE "public"."Profile"
ADD CONSTRAINT "fk_Profile_user"
FOREIGN KEY ("userId")
REFERENCES "public"."User" ("id");

-- constraint: fk_Order_user
ALTER TABLE "public"."Order"
ADD CONSTRAINT "fk_Order_user"
FOREIGN KEY ("userId")
REFERENCES "public"."User" ("id");

-- constraint: fk_ProductOrder_order
ALTER TABLE "public"."ProductOrder"
ADD CONSTRAINT "fk_ProductOrder_order"
FOREIGN KEY ("orderId")
REFERENCES "public"."Order" ("id");

-- constraint: fk_ProductOrder_product
ALTER TABLE "public"."ProductOrder"
ADD CONSTRAINT "fk_ProductOrder_product"
FOREIGN KEY ("productId")
REFERENCES "public"."Product" ("id");

COMMIT;

-- Down Migration
BEGIN;

-- enum: OrderStatus
DROP TYPE IF EXISTS "public"."OrderStatus" CASCADE;

-- enum: UserRole
DROP TYPE IF EXISTS "public"."UserRole" CASCADE;

-- extension: uuid-ossp
DROP EXTENSION IF EXISTS "uuid-ossp";

-- extension: postgis
DROP EXTENSION IF EXISTS "postgis";

-- extension: pgcrypto
DROP EXTENSION IF EXISTS "pgcrypto";

-- constraint: fk_ProductOrder_product
ALTER TABLE "public"."ProductOrder"
DROP CONSTRAINT IF EXISTS "fk_ProductOrder_product";

-- constraint: fk_ProductOrder_order
ALTER TABLE "public"."ProductOrder"
DROP CONSTRAINT IF EXISTS "fk_ProductOrder_order";

-- constraint: fk_Order_user
ALTER TABLE "public"."Order"
DROP CONSTRAINT IF EXISTS "fk_Order_user";

-- constraint: fk_Profile_user
ALTER TABLE "public"."Profile"
DROP CONSTRAINT IF EXISTS "fk_Profile_user";

-- index: idx_Profile_userId
DROP INDEX IF EXISTS "public"."idx_Profile_userId";

-- index: idx_User_email
DROP INDEX IF EXISTS "public"."idx_User_email";

-- table: ProductOrder
DROP TABLE IF EXISTS "public"."ProductOrder" CASCADE;

-- table: Product
DROP TABLE IF EXISTS "public"."Product" CASCADE;

-- table: Order
DROP TABLE IF EXISTS "public"."Order" CASCADE;

-- table: Profile
DROP TABLE IF EXISTS "public"."Profile" CASCADE;

-- table: User
DROP TABLE IF EXISTS "public"."User" CASCADE;

COMMIT;