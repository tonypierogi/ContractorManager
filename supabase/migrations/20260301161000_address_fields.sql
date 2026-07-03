-- Migration: Convert single billing_address to structured address fields
-- Run this in your Supabase SQL Editor if you have an existing database

-- Step 1: Add the new address columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_street2 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_zip TEXT;

-- Step 2 (Optional): Drop the old billing_address column
-- Only run this after verifying the new columns are working
-- ALTER TABLE profiles DROP COLUMN IF EXISTS billing_address;
