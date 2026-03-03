-- Add admin_token column to tournaments for QR-based admin access without login
ALTER TABLE tournaments ADD COLUMN admin_token text;

-- Generate tokens for existing tournaments
UPDATE tournaments SET admin_token = substr(md5(random()::text), 1, 12) WHERE admin_token IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE tournaments ALTER COLUMN admin_token SET NOT NULL;

-- Unique index for token lookup
CREATE UNIQUE INDEX idx_tournaments_admin_token ON tournaments(admin_token);
