const axios = require('axios');

async function checkSpecificChannels() {
    try {
        const res = await axios.get('http://localhost:3000/api/channels');
        const channels = res.data.data;
        const targets = ['niyaar_importer', 'univershopper', 'cheaperzone', 'qualityzone'];

        targets.forEach(username => {
            const c = channels.find(ch => ch.username === username);
            console.log(`User: ${username}`);
            if (c) {
                console.log(`URL: ${c.image_url}`);
                console.log(`Length: ${c.image_url ? c.image_url.length : 0}`);
            } else {
                console.log('Not found');
            }
            console.log('---');
        });
    } catch (e) {
        console.error('Check failed:', e.message);
    }
}

checkSpecificChannels();
