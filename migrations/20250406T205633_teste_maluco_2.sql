-- Migration: teste_maluco_2
-- Version: 20250406T205633
-- Timestamp: 2025-04-06T20:56:33.248Z

-- Up Migration
BEGIN;

-- Add your custom up migration SQL here
-- Example:
-- CREATE TABLE public.your_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP NOT NULL DEFAULT NOW()
-- );

COMMIT;

-- Down Migration
BEGIN;

-- Add your custom down migration SQL here
-- This should revert the changes made in the up migration
-- Example:
-- DROP TABLE IF EXISTS public.your_table;

COMMIT;
