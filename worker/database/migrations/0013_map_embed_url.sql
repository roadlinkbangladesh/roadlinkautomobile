-- Migration 0013: Add map_embed_url column to business_locations
ALTER TABLE business_locations ADD COLUMN map_embed_url TEXT;
