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
            added_on: new Date().toISOString(),
            last_updated: new Date().toISOString()
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


// --- Analytics Endpoints ---

// GET Analytics History
app.get('/api/analytics', async (req, res) => {
    try {
        const { data, error } = await db_api.get('/analytics_history?select=*&order=timestamp.desc');
        res.json({ success: true, data: data });
    } catch (error) {
        console.error('Error fetching analytics:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
    }
});

// POST Record Analytics Snapshot
app.post('/api/analytics', async (req, res) => {
    try {
        // 1. Fetch current channels to snapshot
        const channelsRes = await db_api.get('/channels?select=*');
        const currentChannels = channelsRes.data;

        // 2. Insert into analytics_history
        // The table has: id, timestamp, details (jsonb)
        // We'll store the full array in 'details' as seen in the user's DB.
        const snapshot = {
            timestamp: new Date().toISOString(),
            details: currentChannels
        };

        const insertRes = await db_api.post('/analytics_history', snapshot);
        res.json({ success: true, message: 'Snapshot recorded.', data: snapshot });

    } catch (error) {
        console.error('Error recording analytics:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to record snapshot.' });
    }
});

// DELETE Clear Analytics History
app.delete('/api/analytics', async (req, res) => {
    try {
        // Supabase doesn't support "TRUNCATE" via REST easily without RLS policies allowing generic deletes.
        // We'll delete where id is not null (hacky but works if valid UUIDs).
        // Better: Delete all records.
        await db_api.delete('/analytics_history?id=neq.00000000-0000-0000-0000-000000000000');
        // Note: The above might fail if no records. 
        // Alternative: Let's assume the user has RLS disabled or policy allows ALL.

        res.json({ success: true, message: 'History cleared.' });
    } catch (error) {
        // If the above delete strategy is too strict, we might need to fetch IDs then delete.
        // For now, let's try the simple filter.
        console.error('Error clearing analytics:', error.message);
        res.status(500).json({ success: false, message: 'Failed to clear history.' });
    }
});


// --- Bulk Sync Endpoint (Parallel Processing) ---
app.post('/api/channels/sync', async (req, res) => {
    // Client-Side Chunking: Client sends a batch of channels to process
    const { channels: requestedChannels } = req.body;
    console.log('[SYNC] Starting batch sync...');

    const CONCURRENCY_LIMIT = 5;

    try {
        let channelsToProcess = [];

        if (requestedChannels && Array.isArray(requestedChannels) && requestedChannels.length > 0) {
            // Use provided batch
            channelsToProcess = requestedChannels;
            console.log(`[SYNC] Processing client batch of ${channelsToProcess.length} channels.`);
        } else {
            // Fallback: Fetch all from DB (Old behavior)
            console.log('[SYNC] No channels provided, fetching all from DB...');
            const { data: allChannels, error } = await db_api.get('/channels?select=*');
            if (error) throw error;
            channelsToProcess = allChannels;
        }

        if (!channelsToProcess || channelsToProcess.length === 0) return res.json({ success: true, message: 'No channels to sync.' });

        // ... Logic continues with channelsToProcess ...
        const channels = channelsToProcess;

        let updatedCount = 0;
        let failedCount = 0;

        // 2. Helper function to process a single channel
        const processChannel = async (channel) => {
            try {
                // Use t.me/s/ (Preview) for potentially lighter/faster access, or stick to t.me/
                // Sticking to t.me/ for consistency with existing logic but wrapped for error handling
                const scrapeUrl = `https://t.me/${channel.username}`;
                const response = await axios.get(scrapeUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    timeout: 10000 // 10s timeout
                });

                const $ = cheerio.load(response.data);
                const subscribers = $('div.tgme_page_extra').text().trim();
                const image_url = $('img.tgme_page_photo_image').attr('src');
                const description = $('div.tgme_page_description').text().trim();
                const name = $('div.tgme_page_title').text().trim();

                if (!name) throw new Error('Could not parse channel name');

                // Upsert updated data
                await db_api.post('/channels', {
                    ...channel,
                    name,
                    subscribers,
                    description,
                    avatar_url: image_url,
                    last_updated: new Date().toISOString()
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    }
                });
                updatedCount++;
            } catch (err) {
                console.error(`[SYNC] Failed ${channel.username}: ${err.message}`);
                failedCount++;
            }
        };

        // 3. Process in Batches
        for (let i = 0; i < channels.length; i += CONCURRENCY_LIMIT) {
            const batch = channels.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(c => processChannel(c)));
            console.log(`[SYNC] Processed batch ${i / CONCURRENCY_LIMIT + 1}/${Math.ceil(channels.length / CONCURRENCY_LIMIT)}`);
        }

        res.json({
            success: true,
            message: `Sync complete. Updated: ${updatedCount}, Failed: ${failedCount}`,
            stats: { updated: updatedCount, failed: failedCount }
        });

    } catch (error) {
        console.error('Error during bulk sync:', error.message);
        res.status(500).json({ success: false, message: 'Bulk sync failed.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

