const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('Please provide a migration filename (e.g., 20260127_add_invoices_columns.sql)');
    process.exit(1);
}

async function runMigration() {
    const connectionString = 'postgresql://postgres.skolvxmcritlzepnaogd:1hOvz4QifaiOvdTp@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log(`Connected. Applying ${migrationFile}...`);

        const filePath = path.join(__dirname, '../supabase/migrations', migrationFile);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query(sql);
        console.log('Migration successfully applied!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
