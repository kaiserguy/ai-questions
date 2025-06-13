-- Migration: Add prompt_version column to answers table
-- This migration adds a column to track which version of the prompt was used for each answer

-- Add the column if it doesn't exist
ALTER TABLE answers ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(10);

-- Update existing records to use version "1.0" (pre-concise version)
UPDATE answers SET prompt_version = '1.0' WHERE prompt_version IS NULL;

-- Add a comment to the column
COMMENT ON COLUMN answers.prompt_version IS 'Version of the prompt template used to generate this answer';
