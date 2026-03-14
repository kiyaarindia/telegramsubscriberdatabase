const axios = require('axios');

async function triggerSync() {
    try {
        console.log('Triggering sync...');
        const res = await axios.post('http://localhost:3000/api/channels/sync', { channels: [] });
        console.log('Sync Response:', res.data);
    } catch (e) {
        console.error('Sync failed:', e.message);
    }
}

triggerSync();
