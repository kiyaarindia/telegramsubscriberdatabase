const axios = require('axios');

async function checkSync() {
    console.log('Testing /api/channels/sync endpoint...');
    try {
        const res = await axios.post('http://localhost:3000/api/channels/sync', {
            channels: []
        });
        console.log('✅ Response Status:', res.status);
        console.log('✅ Response Data:', res.data);
    } catch (error) {
        if (error.response) {
            console.error('❌ Error Status:', error.response.status);
            console.error('❌ Error Data:', error.response.data);
        } else {
            console.error('❌ Connection Error:', error.message);
        }
    }
}

checkSync();
