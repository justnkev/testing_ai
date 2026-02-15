const { Client } = require('pg');

async function inspectPolicies() {
    const connectionString = 'postgresql://postgres.skolvxmcritlzepnaogd:1hOvz4QifaiOvdTp@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const query = `
            SELECT * FROM pg_policies WHERE tablename = 'invoices';
        `;

        const res = await client.query(query);
        console.log('Invoices Policies:', res.rows);

        const rlsQuery = `
            SELECT relname, relrowsecurity 
            FROM pg_class 
            WHERE relname = 'invoices';
        `;
        const rlsRes = await client.query(rlsQuery);
        console.log('RLS Enabled:', rlsRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspectPolicies();
