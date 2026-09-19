-- Migration: a photo on each piece of furniture
--
-- Follows 20260919150000_floor_plan_lines.sql.
--
-- "6' banquet table" doesn't tell a new crew member which of the three kinds
-- of table in the basement is meant. A photo does. It's shown in the
-- furniture library, in the picker, and when a piece is tapped in a layout.
--
-- Stored like every other photo in the app: a public URL into the sop-media
-- bucket, under {userId}/furniture/. NULL = no photo.

ALTER TABLE furniture_pieces ADD COLUMN IF NOT EXISTS photo_url TEXT;
