const { Client } = require('pg');

async function inspectSchema() {
    const connectionString = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const query = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'invoices';
        `;

        const res = await client.query(query);
        console.log('Invoices Table Schema:', res.rows);

        // Check for invoice_items table
        const itemsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'invoice_items';
        `;
        const itemsRes = await client.query(itemsQuery);
        console.log('Invoice Items Table Schema:', itemsRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspectSchema();
