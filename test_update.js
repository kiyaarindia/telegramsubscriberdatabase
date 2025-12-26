const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function testUpdate() {
    // 1. Pick a channel (e.g., 'telegram')
    const channel = 'telegram';

    console.log(`[1] Fetching fresh data for @${channel}...`);
    try {
        // Trigger the scrape/update endpoint
        const res = await axios.post(`${API_URL}/channel`, {
            channelIdentifier: channel
        });

        if (res.data.success) {
            console.log('✅ Update successful!');
            console.log('Data:', res.data.data);
        } else {
            console.error('❌ Update failed:', res.data.message);
        }

    } catch (error) {
        console.error('❌ Error calling API:', error.message);
    }
}

testUpdate();
