# FitVision App Archive

This directory contains the code and assets for the legacy FitVision application.

## Structure

- **backend/**: Python Flask backend (`app/`, `server.py`, `requirements.txt`).
- **mobile/**: iOS and Android mobile application code.
- **docs/**: Product Requirements Documents (PRDs) and other documentation.
- **archive-assets/**: Static assets (images, icons) from the public folder (if any).

## History

This codebase was archived when the repository was pivoted to the Field Service App. The code is preserved here for reference.

## Database

The database schema and data have been exported to `fitvision_export.sql`. To restore the database:
1. Create a new Supabase project.
2. Open the SQL Editor.
3. Paste and run the contents of `fitvision_export.sql`.
