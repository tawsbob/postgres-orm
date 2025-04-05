-- Migration: inital
-- Version: 20250405225317
-- Timestamp: 2025-04-05T22:53:17.058Z

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
  "email" VARCHAR(255) UNIQUE,
  "name" VARCHAR(150),
  "role" "public"."UserRole" DEFAULT 'USER'::"public"."UserRole",
  "age" SMALLINT,
  "balance" INTEGER,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- index: User_email_idx
CREATE UNIQUE INDEX "idx_User_email"
ON "public"."User" ("email");

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

-- policy: policy_User_userIsolation
CREATE POLICY "userIsolation" ON "public"."User"
    FOR SELECT, UPDATE
    TO Profile
    USING ((userId = (SELECT current_setting('app.current_user_id')::integer)););

-- policy: policy_User_adminAccess
CREATE POLICY "adminAccess" ON "public"."User"
    FOR ALL
    TO adminRole
    USING (true);

-- table: Profile
DO $$ BEGIN
  CREATE TABLE "public"."Profile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID UNIQUE,
  "bio" TEXT,
  "avatar" VARCHAR(255),
  "location" POINT
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- constraint: Profile_UserProfile_fkey
ALTER TABLE "public"."Profile"
ADD CONSTRAINT "fk_Profile_UserProfile"
FOREIGN KEY ("userId")
REFERENCES "public"."User" ("id");

-- index: Profile_userId_idx
CREATE UNIQUE INDEX "idx_Profile_userId"
ON "public"."Profile" ("userId");

-- table: Order
DO $$ BEGIN
  CREATE TABLE "public"."Order" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID,
  "status" "public"."OrderStatus" DEFAULT 'PENDING'::"public"."OrderStatus",
  "totalAmount" DECIMAL(10,2),
  "items" JSONB,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- constraint: Order_user_fkey
ALTER TABLE "public"."Order"
ADD CONSTRAINT "fk_Order_user"
FOREIGN KEY ("userId")
REFERENCES "public"."User" ("id");

-- table: Product
DO $$ BEGIN
  CREATE TABLE "public"."Product" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255),
  "description" TEXT,
  "price" DECIMAL(10,2),
  "stock" INTEGER,
  "category" VARCHAR(100),
  "tags" TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- table: ProductOrder
DO $$ BEGIN
  CREATE TABLE "public"."ProductOrder" (
  "id" SERIAL PRIMARY KEY,
  "orderId" UUID,
  "productId" UUID,
  "quantity" INTEGER,
  "price" DECIMAL(10,2)
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- constraint: ProductOrder_order_fkey
ALTER TABLE "public"."ProductOrder"
ADD CONSTRAINT "fk_ProductOrder_order"
FOREIGN KEY ("orderId")
REFERENCES "public"."Order" ("id");

-- constraint: ProductOrder_product_fkey
ALTER TABLE "public"."ProductOrder"
ADD CONSTRAINT "fk_ProductOrder_product"
FOREIGN KEY ("productId")
REFERENCES "public"."Product" ("id");

-- table: Testing
DO $$ BEGIN
  CREATE TABLE "public"."Testing" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150),
  "createdAt" TIMESTAMP DEFAULT now()
);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- role: logdUser_create
DO $$ BEGIN
  CREATE ROLE "logdUser";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- role: logdUser_grant_0
GRANT SELECT, INSERT, UPDATE ON "public"."User" TO "logdUser";

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
        IF (OLD.balance <> NEW.balance) THEN RAISE EXCEPTION 'Balance cannot be updated directly'; END IF;
        RETURN NEW;
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
        IF (OLD.stock <> NEW.stock) THEN INSERT INTO product_inventory_log(product_id, old_stock, new_stock, changed_at) VALUES (NEW.id, OLD.stock, NEW.stock, NOW()); END IF;
        RETURN NEW;
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
        IF (OLD.price <> NEW.price) THEN INSERT INTO product_price_history(product_id, old_price, new_price, changed_at) VALUES (OLD.id, OLD.price, NEW.price, NOW());  -- Notify admin if price decreased by more than 25% IF (NEW.price < OLD.price * 0.75) THEN PERFORM pg_notify('price_alerts', 'Product ' || OLD.name || ' price decreased by more than 25%'); END IF; END IF;
        RETURN NEW;
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


-- role: adminRole_create
DROP ROLE IF EXISTS "adminRole";

-- role: logdUser_grant_0


-- role: logdUser_create
DROP ROLE IF EXISTS "logdUser";

-- constraint: ProductOrder_product_fkey
ALTER TABLE "public"."ProductOrder"
DROP CONSTRAINT IF EXISTS "fk_ProductOrder_product";

-- constraint: ProductOrder_order_fkey
ALTER TABLE "public"."ProductOrder"
DROP CONSTRAINT IF EXISTS "fk_ProductOrder_order";

-- constraint: Order_user_fkey
ALTER TABLE "public"."Order"
DROP CONSTRAINT IF EXISTS "fk_Order_user";

-- index: Profile_userId_idx
DROP INDEX IF EXISTS "public"."idx_Profile_userId";

-- constraint: Profile_UserProfile_fkey
ALTER TABLE "public"."Profile"
DROP CONSTRAINT IF EXISTS "fk_Profile_UserProfile";

-- policy: policy_User_adminAccess
DROP POLICY IF EXISTS "adminAccess" ON "public"."User";

-- policy: policy_User_userIsolation
DROP POLICY IF EXISTS "userIsolation" ON "public"."User";

-- rls: rls_User_1
ALTER TABLE "public"."User" DISABLE ROW LEVEL SECURITY;

-- rls: rls_User_0
ALTER TABLE "public"."User" DISABLE ROW LEVEL SECURITY;

-- index: idx_User_email
DROP INDEX IF EXISTS "public"."idx_User_email_unique_filtered";

-- index: active_users_name_idx
DROP INDEX IF EXISTS "public"."active_users_name_idx";

-- index: idx_User_role_isActive
DROP INDEX IF EXISTS "public"."idx_User_role_isActive";

-- index: User_email_idx
DROP INDEX IF EXISTS "public"."idx_User_email";

-- table: Testing
DO $$ BEGIN
  -- Revoke all privileges on the table
  REVOKE ALL PRIVILEGES ON "public"."Testing" FROM PUBLIC;
  REVOKE ALL PRIVILEGES ON "public"."Testing" FROM postgres;
  
  -- Drop the table
  DROP TABLE IF EXISTS "public"."Testing" CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
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