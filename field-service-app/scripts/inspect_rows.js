const { Client } = require('pg');

async function inspectRows() {
    const connectionString = 'postgresql://postgres.skolvxmcritlzepnaogd:1hOvz4QifaiOvdTp@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const query = `
            SELECT id, job_id, organization_id, invoice_number 
            FROM invoices;
        `;

        const res = await client.query(query);
        console.log('Existing Invoices:', res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspectRows();
