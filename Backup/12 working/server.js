const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3000;

// --- Supabase Configuration ---
// IMPORTANT: For a production environment, use a service_role key stored securely in environment variables.
// The anon key is safe to use in a browser context but may be restricted by Row Level Security (RLS) policies.
const SUPABASE_URL = 'https://oiztqkpvsucdinwkoaoi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LAfRFfYJy23a7EW90HZiGQ_SkJewy-L'; // This is the anon key
const db_api = axios.create({
    baseURL: `${SUPABASE_URL}/rest/v1`,
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    }
});

// Use built-in Express middleware for parsing JSON
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

// Login API
// Login API
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Query Supabase for the user
        const response = await db_api.get(`/users?username=eq.${username}&select=*`);
        const users = response.data;

        if (users && users.length > 0) {
            const user = users[0];
            // Simple string comparison for password as per requirements (insecure for production)
            if (user.password === password) {
                return res.json({ success: true, message: 'Login successful' });
            }
        }
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } catch (error) {
        console.error('Login Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Login failed due to server error.' });
    }
});

// GET all channels from Supabase
app.get('/api/channels', async (req, res) => {
    try {
        console.log('Fetching channels from Supabase...');
        const response = await db_api.get('/channels?select=*');
        console.log('Supabase Response Status:', response.status);
        console.log('Supabase Data Length:', response.data ? response.data.length : 0);

        // Map avatar_url to image_url for frontend compatibility
        const data = response.data.map(channel => ({
            ...channel,
            image_url: channel.avatar_url || channel.image_url // Fallback if both exist
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching from Supabase:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch channels from database.' });
    }
});


// Scrape Telegram data and SAVE it to Supabase
app.post('/api/channel', async (req, res) => {
    const { channelIdentifier } = req.body;

    if (!channelIdentifier) {
        return res.status(400).json({ success: false, message: 'Channel identifier is required' });
    }

    let username = channelIdentifier;
    if (channelIdentifier.includes('t.me/')) {
        const parts = channelIdentifier.split('t.me/');
        username = parts[1].split('/')[0].split('?')[0];
    }
    username = username.replace('@', '').trim();

    const scrapeUrl = `https://t.me/${username}`;

    try {
        console.log(`[DEBUG] Scraping URL: ${scrapeUrl}`);

        // 1. Scrape the data
        const response = await axios.get(scrapeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });

        console.log(`[DEBUG] Scrape Status: ${response.status}`);

        const html = response.data;
        const $ = cheerio.load(html);

        const name = $('div.tgme_page_title').text().trim();
        const subscribers = $('div.tgme_page_extra').text().trim();
        const description = $('div.tgme_page_description').text().trim();
        const image_url = $('img.tgme_page_photo_image').attr('src');

        console.log(`[DEBUG] Extracted Data: Name=${name}, Subs=${subscribers}, Desc=${description?.substring(0, 20)}...`);

        if (!name) {
            console.error('[ERROR] Name not found in scraped page.');
            return res.status(404).json({ success: false, message: 'Channel not found or invalid Telegram URL.' });
        }

        const channelData = {
            name,
            subscribers,
            username,
            description,
            avatar_url: image_url, // Save to avatar_url column
            added_on: new Date().toISOString()
            // last_updated removed - column does not exist in DB
        };

        // 2. Save the data to Supabase using upsert (Corrected axios call)
        console.log('[DEBUG] Attempting Supabase Upsert...');
        const upsertResponse = await db_api.post('/channels', channelData, {
            headers: {
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates' // Upsert on unique constraint (e.g., username)
            }
        });
        console.log(`[DEBUG] Supabase Status: ${upsertResponse.status}`);

        res.json({ success: true, data: { ...channelData, image_url }, message: 'Channel data fetched and saved successfully.' });

    } catch (error) {
        console.error('Error in /api/channel:', error.message);
        if (error.response) {
            console.error('[DEBUG] Error Response Data:', JSON.stringify(error.response.data));
            console.error('[DEBUG] Error Response Status:', error.response.status);
        }
        res.status(500).json({ success: false, message: 'Failed to process channel.' });
    }
});

// DELETE a channel from Supabase
app.delete('/api/channels/:username', async (req, res) => {
    const { username } = req.params;
    try {
        await db_api.delete(`/channels?username=eq.${username}`);
        res.json({ success: true, message: `Channel '${username}' deleted successfully.` });
    } catch (error) {
        console.error('Error deleting from Supabase:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: `Failed to delete channel '${username}'.` });
    }
});

// UPDATE a channel in Supabase (e.g., for ownership)
app.put('/api/channels/:username', async (req, res) => {
    const { username } = req.params;
    const { ownership } = req.body; // Expecting { "ownership": "Owned" } or similar

    if (ownership === undefined) {
        return res.status(400).json({ success: false, message: 'Ownership property is required.' });
    }

    try {
        // Corrected axios call
        const { data } = await db_api.patch(`/channels?username=eq.${username}`, { ownership }, {
            headers: {
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        res.json({ success: true, data: data[0], message: 'Channel ownership updated.' });
    } catch (error) {
        console.error('Error updating in Supabase:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to update channel.' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

