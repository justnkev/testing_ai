const { Client } = require('pg');

async function debugConstraint() {
    const connectionString = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const query = `
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'estimates_status_check';
        `;

        const res = await client.query(query);

        if (res.rows.length === 0) {
            console.log('Constraint estimates_status_check NOT FOUND.');

            // Try to find ANY check constraint on estimates table
            const tableQuery = `
                SELECT conname, pg_get_constraintdef(oid) as definition
                FROM pg_constraint
                WHERE conrelid = 'estimates'::regclass;
            `;
            const tableRes = await client.query(tableQuery);
            console.log('All constraints on estimates table:', tableRes.rows);
        } else {
            console.log('Constraint Definition:', res.rows[0].definition);
        }

    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        await client.end();
    }
}

debugConstraint();
