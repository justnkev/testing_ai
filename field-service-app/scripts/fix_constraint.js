const { Client } = require('pg');

async function fixConstraint() {
    const connectionString = 'postgresql://postgres.skolvxmcritlzepnaogd:1hOvz4QifaiOvdTp@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        console.log('Dropping incorrect constraint...');
        await client.query(`ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_status_check;`);

        console.log('Sanitizing existing data...');
        await client.query(`
            UPDATE estimates 
            SET status = 'DRAFT' 
            WHERE status NOT IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');
        `);

        console.log('Adding correct constraint...');
        await client.query(`
            ALTER TABLE estimates 
            ADD CONSTRAINT estimates_status_check 
            CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'));
        `);

        console.log('Updating default value...');
        await client.query(`ALTER TABLE estimates ALTER COLUMN status SET DEFAULT 'DRAFT';`);

        console.log('Constraint fixed successfully!');

    } catch (err) {
        console.error('Fix failed:', err);
    } finally {
        await client.end();
    }
}

fixConstraint();
