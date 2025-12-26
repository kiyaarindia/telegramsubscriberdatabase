const axios = require('axios');

const SUPABASE_URL = 'https://oiztqkpvsucdinwkoaoi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LAfRFfYJy23a7EW90HZiGQ_SkJewy-L'; // Anon key

const db_api = axios.create({
    baseURL: `${SUPABASE_URL}/rest/v1`,
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    }
});

async function checkWrite() {
    try {
        console.log('Testing Supabase WRITE (Insert/Update)...');

        const dummyData = {
            username: 'test_write_permission',
            name: 'Test Channel',
            description: 'Testing write permissions',
            subscribers: '0',
            status: 'Active'
            // added_on intentionally omitted to test default value constraint
        };

        // Try to Insert
        const response = await db_api.post('/channels', dummyData);
        console.log('WRITE Status:', response.status);
        console.log('WRITE Success! RLS policies are likely correct.');

        // Cleanup if successful
        console.log('Cleaning up test data...');
        await db_api.delete(`/channels?username=eq.${dummyData.username}`);
        console.log('Cleanup successful.');

    } catch (error) {
        console.error('WRITE Error:', error.response ? error.response.data : error.message);
        console.log('\n--- DIAGNOSIS ---');
        if (error.response && error.response.status === 401) {
            console.log('❌ RLS ERROR: You need to enable INSERT, UPDATE, and DELETE policies for the "channels" table in Supabase.');
        } else {
            console.log('❌ OTHER ERROR: Check the error message above.');
        }
    }
}

checkWrite();
