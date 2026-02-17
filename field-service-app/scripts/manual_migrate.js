const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const connectionString = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Explicitly use no ssl or simple ssl compatible with Supabase PGBouncer
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    const migrations = [
        '20260125_create_multitenancy.sql',
        '20260127_create_estimates.sql'
    ];

    try {
        await client.connect();
        console.log('Connected to database.');

        for (const file of migrations) {
            const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', file);
            console.log(`\n--- Applying ${file} ---`);
            const sql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await client.query(sql);
                console.log(`Success: ${file}`);
            } catch (queryErr) {
                console.error(`Error executing ${file}:`);
                console.error(queryErr.message);
                // Check if it's "relation already exists" or similar idempotent error?
                // For now, we continue or stop?
                // Usually safer to stop, but if it's "relation exists", maybe continue.
                // Let's decide to Log and Stop to be safe.
                throw queryErr;
            }
        }

        console.log('\nAll migrations successfully applied!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
