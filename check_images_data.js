const axios = require('axios');

async function checkImages() {
    try {
        console.log('Checking channels...');
        const res = await axios.get('http://localhost:3000/api/channels');
        const channels = res.data.data;
        channels.slice(0, 10).forEach(c => {
            console.log(`Channel: ${c.username}`);
            console.log(`Image URL: ${c.image_url}`);
            console.log('---');
        });
    } catch (e) {
        console.error('Check failed:', e.message);
    }
}

checkImages();
