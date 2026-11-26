-- One optional cover image per project / journal.
-- Stores only the uploaded file's name (e.g. 3f2c...-....jpg); the file lives in UPLOAD_DIR.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT NULL;
ALTER TABLE journals ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT NULL;
