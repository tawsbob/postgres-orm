-- Migration: initial
-- Version: 20250406041029
-- Timestamp: 2025-04-06T04:10:29.483Z

-- Up Migration
BEGIN;

-- extension: pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto" VERSION '1.3';

-- extension: postgis
CREATE EXTENSION IF NOT EXISTS "postgis";

-- extension: uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- table: User
DO $$ BEGIN
  CREATE TABLE "public"."User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "role" "public"."UserRole" DEFAULT 'USER'::"public"."UserRole" NOT NULL,
  "age" SMALLINT,
  "balance" INTEGER NOT NULL,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- index: idx_User_role_isActive
CREATE INDEX "idx_User_role_isActive" ON "public"."User"  ("role", "isActive") ;

-- index: active_users_name_idx
CREATE INDEX "active_users_name_idx" ON "public"."User" USING btree ("name") WHERE isActive = true;

-- index: idx_User_email
CREATE UNIQUE INDEX "idx_User_email_unique_filtered" ON "public"."User"  ("email") WHERE role = 'PUBLIC';

-- rls: rls_User_0
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;

-- rls: rls_User_1
ALTER TABLE "public"."User" FORCE ROW LEVEL SECURITY;

-- table: Profile
DO $$ BEGIN
  CREATE TABLE "public"."Profile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID UNIQUE NOT NULL,
  "bio" TEXT NOT NULL,
  "avatar" VARCHAR(255) NOT NULL,
  "location" POINT NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- index: idx_Profile_userId
CREATE UNIQUE INDEX "idx_Profile_userId"
ON "public"."Profile" ("userId");

-- table: Order
DO $$ BEGIN
  CREATE TABLE "public"."Order" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "status" "public"."OrderStatus" DEFAULT 'PENDING'::"public"."OrderStatus" NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- index: idx_Order_userId
CREATE INDEX "idx_Order_userId" ON "public"."Order"  ("userId") ;

-- index: order_status_created_idx
CREATE INDEX "order_status_created_idx" ON "public"."Order"  ("status", "createdAt") ;

-- table: Log
DO $$ BEGIN
  CREATE TABLE "public"."Log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now() NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- table: Product
DO $$ BEGIN
  CREATE TABLE "public"."Product" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "stock" INTEGER NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "tags" TEXT[] NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now() NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- table: ProductOrder
DO $$ BEGIN
  CREATE TABLE "public"."ProductOrder" (
  "id" SERIAL PRIMARY KEY,
  "orderId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "price" DECIMAL(10,2) NOT NULL
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- constraint: Profile_UserProfile_fkey
ALTER TABLE "public"."Profile"
ADD CONSTRAINT "fk_Profile_UserProfile"
FOREIGN KEY ("userId")
REFERENCES "public"."User" ("id")
ON DELETE CASCADE
ON UPDATE SET NULL;

-- constraint: Order_user_fkey
ALTER TABLE "public"."Order"
ADD CONSTRAINT "fk_Order_user"
FOREIGN KEY ("userId")
REFERENCES "public"."User" ("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- constraint: ProductOrder_order_fkey
ALTER TABLE "public"."ProductOrder"
ADD CONSTRAINT "fk_ProductOrder_order"
FOREIGN KEY ("orderId")
REFERENCES "public"."Order" ("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- constraint: ProductOrder_product_fkey
ALTER TABLE "public"."ProductOrder"
ADD CONSTRAINT "fk_ProductOrder_product"
FOREIGN KEY ("productId")
REFERENCES "public"."Product" ("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;

-- policy: policy_User_userIsolation
CREATE POLICY "userIsolation" ON "public"."User"
    FOR SELECT, UPDATE
    TO userRole
    USING (id = (SELECT current_setting('app.current_user_id')::uuid));

-- policy: policy_User_adminAccess
CREATE POLICY "adminAccess" ON "public"."User"
    FOR ALL
    TO adminRole
    USING (true);

-- role: userRole_create
DO $$ BEGIN
  CREATE ROLE "userRole";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- role: userRole_grant_0
GRANT SELECT, INSERT, UPDATE ON "public"."User" TO "userRole";

-- role: adminRole_create
DO $$ BEGIN
  CREATE ROLE "adminRole";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- role: adminRole_grant_0
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."User" TO "adminRole";

-- trigger: User_before_update_for_each_row_trigger
-- Create or replace the trigger function
      CREATE OR REPLACE FUNCTION "public"."User_before_update_for_each_row_trigger_fn"()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (OLD.balance <> NEW.balance) THEN RAISE EXCEPTION 'Balance cannot be updated directly'; END IF; RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create the trigger
      CREATE TRIGGER User_before_update_for_each_row_trigger
      BEFORE UPDATE
      FOR EACH ROW
      ON "public"."User"
      EXECUTE FUNCTION "public"."User_before_update_for_each_row_trigger_fn"();

-- trigger: Product_after_update_for_each_row_trigger
-- Create or replace the trigger function
      CREATE OR REPLACE FUNCTION "public"."Product_after_update_for_each_row_trigger_fn"()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (OLD.stock <> NEW.stock) THEN INSERT INTO Log (message) VALUES ('Tabela Product atualizada AFTER UPDATE'); RETURN NEW; END IF;
      END;
      $$ LANGUAGE plpgsql;

      -- Create the trigger
      CREATE TRIGGER Product_after_update_for_each_row_trigger
      AFTER UPDATE
      FOR EACH ROW
      ON "public"."Product"
      EXECUTE FUNCTION "public"."Product_after_update_for_each_row_trigger_fn"();

-- trigger: Product_before_update_for_each_row_trigger
-- Create or replace the trigger function
      CREATE OR REPLACE FUNCTION "public"."Product_before_update_for_each_row_trigger_fn"()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (OLD.price <> NEW.price) THEN INSERT INTO Log (message) VALUES ('Tabela Product atualizada BEFORE UPDATE'); RETURN NEW; END IF;
      END;
      $$ LANGUAGE plpgsql;

      -- Create the trigger
      CREATE TRIGGER Product_before_update_for_each_row_trigger
      BEFORE UPDATE
      FOR EACH ROW
      ON "public"."Product"
      EXECUTE FUNCTION "public"."Product_before_update_for_each_row_trigger_fn"();

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

-- trigger: Product_before_update_for_each_row_trigger
-- Drop the trigger
      DROP TRIGGER IF EXISTS Product_before_update_for_each_row_trigger ON "public"."Product";
      
      -- Drop the function
      DROP FUNCTION IF EXISTS "public"."Product_before_update_for_each_row_trigger_fn"();

-- trigger: Product_after_update_for_each_row_trigger
-- Drop the trigger
      DROP TRIGGER IF EXISTS Product_after_update_for_each_row_trigger ON "public"."Product";
      
      -- Drop the function
      DROP FUNCTION IF EXISTS "public"."Product_after_update_for_each_row_trigger_fn"();

-- trigger: User_before_update_for_each_row_trigger
-- Drop the trigger
      DROP TRIGGER IF EXISTS User_before_update_for_each_row_trigger ON "public"."User";
      
      -- Drop the function
      DROP FUNCTION IF EXISTS "public"."User_before_update_for_each_row_trigger_fn"();

-- role: adminRole_grant_0
REVOKE SELECT, INSERT, UPDATE, DELETE ON "public"."User" FROM "adminRole";

-- role: adminRole_create
DROP ROLE IF EXISTS "adminRole";

-- role: userRole_grant_0
REVOKE SELECT, INSERT, UPDATE ON "public"."User" FROM "userRole";

-- role: userRole_create
DROP ROLE IF EXISTS "userRole";

-- policy: policy_User_adminAccess
DROP POLICY IF EXISTS "adminAccess" ON "public"."User";

-- policy: policy_User_userIsolation
DROP POLICY IF EXISTS "userIsolation" ON "public"."User";

-- constraint: ProductOrder_product_fkey
ALTER TABLE "public"."ProductOrder"
DROP CONSTRAINT IF EXISTS "fk_ProductOrder_product";

-- constraint: ProductOrder_order_fkey
ALTER TABLE "public"."ProductOrder"
DROP CONSTRAINT IF EXISTS "fk_ProductOrder_order";

-- constraint: Order_user_fkey
ALTER TABLE "public"."Order"
DROP CONSTRAINT IF EXISTS "fk_Order_user";

-- constraint: Profile_UserProfile_fkey
ALTER TABLE "public"."Profile"
DROP CONSTRAINT IF EXISTS "fk_Profile_UserProfile";

-- index: order_status_created_idx
DROP INDEX IF EXISTS "public"."order_status_created_idx";

-- index: idx_Order_userId
DROP INDEX IF EXISTS "public"."idx_Order_userId";

-- index: idx_Profile_userId
DROP INDEX IF EXISTS "public"."idx_Profile_userId";

-- rls: rls_User_1
ALTER TABLE "public"."User" NO FORCE ROW LEVEL SECURITY;

-- rls: rls_User_0
ALTER TABLE "public"."User" DISABLE ROW LEVEL SECURITY;

-- index: idx_User_email
DROP INDEX IF EXISTS "public"."idx_User_email_unique_filtered";

-- index: active_users_name_idx
DROP INDEX IF EXISTS "public"."active_users_name_idx";

-- index: idx_User_role_isActive
DROP INDEX IF EXISTS "public"."idx_User_role_isActive";

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

-- table: Product
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."Product" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."Product" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."Product" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- table: Log
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."Log" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."Log" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."Log" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- table: Order
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."Order" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."Order" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."Order" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- table: Profile
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."Profile" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."Profile" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."Profile" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- table: User
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."User" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."User" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."User" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

COMMIT;