-- Add latitude and longitude columns to fs_jobs table
ALTER TABLE fs_jobs 
ADD COLUMN IF NOT EXISTS latitude double precision NULL,
ADD COLUMN IF NOT EXISTS longitude double precision NULL;
