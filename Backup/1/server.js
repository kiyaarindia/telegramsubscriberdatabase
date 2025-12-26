const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Fetch Telegram Data API
app.post('/api/channel', async (req, res) => {
    const { channelIdentifier } = req.body; 
    
    if (!channelIdentifier) {
        return res.status(400).json({ success: false, message: 'Channel identifier is required' });
    }

    let username = channelIdentifier;
    // Extract username if full URL is provided
    if (channelIdentifier.includes('t.me/')) {
        const parts = channelIdentifier.split('t.me/');
        // Handle cases like https://t.me/username or t.me/username/123
        username = parts[1].split('/')[0].split('?')[0];
    }
    username = username.replace('@', '').trim();

    const url = `https://t.me/${username}`;

    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const title = $('div.tgme_page_title').text().trim();
        const extra = $('div.tgme_page_extra').text().trim(); // e.g., "10 000 subscribers"
        const description = $('div.tgme_page_description').text().trim();
        const image = $('img.tgme_page_photo_image').attr('src');

        if (!title) {
             return res.status(404).json({ success: false, message: 'Channel not found or invalid' });
        }

        res.json({
            success: true,
            data: {
                name: title,
                subscribers: extra,
                username: username,
                description: description,
                image: image
            }
        });

    } catch (error) {
        console.error('Error fetching telegram data:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch channel data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
