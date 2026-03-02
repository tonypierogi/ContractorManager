-- Migration: Add OpenAI API key storage to business_settings
-- Used for client-side video transcription and task generation.
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS openai_api_key TEXT;
