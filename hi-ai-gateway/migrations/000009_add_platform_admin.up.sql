-- Add is_platform_admin column to users table
ALTER TABLE users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Set the platform owner as admin
UPDATE users SET is_platform_admin = TRUE WHERE email = '1615627276@qq.com';
