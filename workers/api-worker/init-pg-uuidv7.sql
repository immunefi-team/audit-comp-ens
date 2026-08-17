-- Install and enable pg_uuidv7 extension
-- This extension provides UUID v7 generation capabilities
-- Create the extension
CREATE EXTENSION IF NOT EXISTS "pg_uuidv7";

-- Verify the extension is installed
SELECT
  extname,
  extversion
FROM
  pg_extension
WHERE
  extname = 'pg_uuidv7';