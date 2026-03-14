const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// --- Supabase Configuration ---
// IMPORTANT: For a production environment, use a service_role key stored securely in environment variables.
// The anon key is safe to use in a browser context but may be restricted by Row Level Security (RLS) policies.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // This is the anon key
const db_api = axios.create({
    baseURL: `${SUPABASE_URL}/rest/v1`,
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    }
});

// --- Helper Functions ---

/**
 * Scrapes live channel data from Telegram history preview (/s/ path)
 */
async function scrapeChannelData(username) {
    const scrapeUrl = `https://t.me/s/${username}?t=${Date.now()}`;
    const response = await axios.get(scrapeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // History page selectors (/s/ path)
    let name = $('.tgme_channel_info_header_title').text().trim();
    let subscribers = $('.tgme_header_counter').text().trim();
    let description = $('.tgme_channel_info_description').text().trim();

    // Extract image from background-image style if available
    let image_url = '';
    const style = $('.tgme_page_photo_image').attr('style');
    if (style && style.includes('background-image')) {
        const match = style.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1]) {
            image_url = match[1];
        }
    }

    // Fallback to standard selectors
    if (!name) name = $('div.tgme_page_title').text().trim();
    if (!subscribers) subscribers = $('div.tgme_page_extra').text().trim();
    if (!description) description = $('div.tgme_page_description').text().trim();

    // Improved image scraping
    if (!image_url) image_url = $('.tgme_page_photo_image img').attr('src');
    if (!image_url) image_url = $('img.tgme_page_photo_image').attr('src');

    // Ensure absolute URL
    if (image_url && !image_url.startsWith('http') && !image_url.startsWith('data')) {
        image_url = 'https://t.me' + (image_url.startsWith('/') ? '' : '/') + image_url;
    }

    let status = 'Active';
    if (!name && (response.status === 404 || response.data.includes('If you have Telegram, you can contact'))) {
        status = 'Inactive';
    }

    return { name, subscribers, description, image_url, status, last_synced_at: new Date().toISOString() };
}

/**
 * Records a snapshot of all current channel data into analytics_history
 */
async function recordSnapshot() {
    console.log(`[TRACKER] Recording snapshot...`);
    const allChannelsRes = await db_api.get('/channels?select=*');
    const snapshot = {
        timestamp: new Date().toISOString(),
        details: allChannelsRes.data
    };
    await db_api.post('/analytics_history', snapshot);
    console.log(`[TRACKER] Snapshot recorded successfully.`);
}

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

        console.log(`[DEBUG] Found ${data.length} channels. Sample image URL: ${data[0] ? data[0].image_url : 'None'}`);

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

    // Use the history preview path (/s/) for more live data
    const scrapeUrl = `https://t.me/s/${username}?t=${Date.now()}`;

    try {
        // 1. Scrape the data using helper
        const { name, subscribers, description, image_url, status, last_synced_at } = await scrapeChannelData(username);

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
            ownership: 'Competitor Channel', // Explicitly set default
            status,
            added_on: new Date().toISOString(),
            last_synced_at
        };

        // 2. Save the data to Supabase using upsert
        await db_api.post('/channels?on_conflict=username', channelData, {
            headers: {
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            }
        });

        res.json({ success: true, data: { ...channelData, image_url }, message: 'Channel data fetched and saved successfully.' });

    } catch (error) {
        console.error('Error in /api/channel:', error.message);
        res.status(500).json({ success: false, message: 'Failed to process channel.' });
    }
});

// GET Live Subscriber Data for a specific channel
app.get('/api/channel/:username/live', async (req, res) => {
    const { username } = req.params;
    try {
        const { name, subscribers, description, image_url, status, last_synced_at } = await scrapeChannelData(username);

        // Only update if we actually got a name (meaning it exists)
        if (name) {
            res.json({ success: true, data: { username, subscribers, name, description, avatar_url: image_url, status, last_synced_at } });

            db_api.patch(`/channels?username=eq.${username}`, {
                subscribers: subscribers || undefined,
                name: name || undefined,
                description: description || undefined,
                avatar_url: image_url || undefined,
                status,
                last_synced_at
            }).catch(err => {
                // ... logging ...
            });
        } else {
            res.json({ success: true, data: { username, status: 'Active' } });
        }

    } catch (error) {
        res.json({ success: true, data: { username, status: 'Active' } });
    }
});

// Image Proxy Endpoint to bypass Telegram referer/hotlinking issues
app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL is required');

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://t.me/'
            },
            timeout: 10000
        });

        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.send(response.data);
    } catch (error) {
        console.error('[PROXY ERROR]', error.message);
        res.status(500).send('Failed to fetch image');
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

// DELETE ALL channels from Supabase
app.delete('/api/channels', async (req, res) => {
    try {
        // PostgREST requires a filter for DELETE. 
        // username=not.is.null will match all records since username is a required field.
        await db_api.delete('/channels?username=not.is.null');
        res.json({ success: true, message: 'All channels removed successfully.' });
    } catch (error) {
        console.error('Error bulk deleting from Supabase:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: 'Failed to clear channels database.' });
    }
});

// UPDATE a channel in Supabase (e.g., for ownership, name, description, username)
app.put('/api/channels/:username', async (req, res) => {
    const { username } = req.params;
    const { ownership, name, description, newUsername } = req.body;

    if (ownership === undefined && name === undefined && description === undefined && newUsername === undefined) {
        return res.status(400).json({ success: false, message: 'No valid properties provided for update.' });
    }

    try {
        let finalUsername = username;
        // Handle ID change
        if (newUsername && newUsername !== username) {
            // Check if the new username already exists
            const checkRes = await db_api.get(`/channels?username=eq.${newUsername}`);
            if (checkRes.data && checkRes.data.length > 0) {
                // Return a specific duplicate error message
                return res.status(409).json({ success: false, message: `Channel ID '@${newUsername}' already exists in the database.`, isDuplicate: true });
            }

            // If it doesn't exist, update the username
            const updateIdRes = await db_api.patch(`/channels?username=eq.${username}`, { username: newUsername });
            finalUsername = newUsername; // Update for subsequent operations
        }


        const updateData = {};
        if (ownership !== undefined) updateData.ownership = ownership;
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;

        let returnedData = null;
        if (Object.keys(updateData).length > 0) {
            const { data } = await db_api.patch(`/channels?username=eq.${finalUsername}`, updateData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            });
            returnedData = data[0];
        } else {
            const { data } = await db_api.get(`/channels?username=eq.${finalUsername}`);
            returnedData = data[0];
        }

        res.json({ success: true, data: returnedData, message: 'Channel updated successfully.', newUsername: finalUsername });
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
        // Use not.is.null to match all records regardless of type
        await db_api.delete('/analytics_history?id=not.is.null');
        res.json({ success: true, message: 'History cleared.' });
    } catch (error) {
        console.error('Error clearing analytics:', error.message);
        res.status(500).json({ success: false, message: 'Failed to clear history.' });
    }
});


// --- Bulk Sync Endpoint (Parallel Processing) ---
app.post('/api/channels/sync', async (req, res) => {
    // Client-Side Chunking: Client sends a batch of channels to process
    const { channels: requestedChannels } = req.body;
    console.log('[SYNC] Starting batch sync...');

    const CONCURRENCY_LIMIT = 3; // Reduced to 3 to minimize rate limiting

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
                // Destructure to remove image_url which is NOT in the DB schema
                const { image_url: _unused, ...safeChannel } = channel;

                // 1. Scrape using helper
                const { name, subscribers, description, image_url, status, last_synced_at } = await scrapeChannelData(channel.username);

                if (name) {
                    // 2. Upsert updated data
                    await db_api.post('/channels?on_conflict=username', {
                        ...safeChannel,
                        name,
                        subscribers,
                        description,
                        avatar_url: image_url,
                        status,
                        last_synced_at
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
                        }
                    });
                    updatedCount++;
                } else {
                    updatedCount++;
                }
            } catch (err) {
                if (err.response?.data?.code === 'PGRST204') {
                    // Retry WITHOUT last_synced_at if it failed because column is missing
                    try {
                        const { last_synced_at: _, ...noSyncData } = {
                            ...safeChannel,
                            name,
                            subscribers,
                            description,
                            avatar_url: image_url,
                            status
                        };
                        await db_api.post('/channels?on_conflict=username', noSyncData, {
                            headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
                        });
                        if (!global.hideSyncWarning) {
                            console.warn(`[Supabase Help] The 'last_synced_at' column is missing. Adding it will enable sync time tracking.`);
                            global.hideSyncWarning = true;
                        }
                    } catch (retryErr) {
                        console.error(`[SYNC] Failed ${channel.username} (Retry):`, retryErr.message);
                        failedCount++;
                    }
                } else {
                    console.error(`[SYNC] Failed ${channel.username}:`, err.message);
                    failedCount++;
                }
            }
        };

        // 3. Process in Batches
        for (let i = 0; i < channels.length; i += CONCURRENCY_LIMIT) {
            const batch = channels.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(c => processChannel(c)));
            console.log(`[SYNC] Processed batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(channels.length / CONCURRENCY_LIMIT)}`);
        }

        // 3. IMPORTANT: Always record a snapshot after a manual batch sync
        console.log('[SYNC] Recording history entry...');
        await recordSnapshot();

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

// --- Server-Side Dynamic Auto Tracker ---

let currentTrackerInterval = 3600000; // Default: 1 hour
let trackerTimer = null;

async function runHourlyTracker() {
    console.log(`[TRACKER] [${new Date().toLocaleString()}] Starting sync and snapshot (Interval: ${currentTrackerInterval / 60000}m)...`);
    try {
        // 1. Fetch all channels
        const channelsRes = await db_api.get('/channels?select=*');
        const channels = channelsRes.data;
        if (!channels || channels.length === 0) return;

        // 2. Sync subscriber counts in batches using helpers
        const CONCURRENCY_LIMIT = 3;
        const processChannelHelper = async (channel) => {
            try {
                const { image_url: _unused, ...safeChannel } = channel;
                const { name, subscribers, description, image_url, status, last_synced_at } = await scrapeChannelData(channel.username);

                if (name) {
                    await db_api.post('/channels?on_conflict=username', {
                        ...safeChannel,
                        name,
                        subscribers,
                        description,
                        avatar_url: image_url,
                        status,
                        last_synced_at
                    }, {
                        headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
                    });
                }
            } catch (err) {
                if (err.response?.data?.code === 'PGRST204') {
                    // Retry WITHOUT last_synced_at
                    try {
                        const { name, subscribers, description, image_url, status } = await scrapeChannelData(channel.username);
                        const { image_url: _unused, ...safeChannel } = channel;
                        await db_api.post('/channels?on_conflict=username', {
                            ...safeChannel,
                            name,
                            subscribers,
                            description,
                            avatar_url: image_url,
                            status
                        }, {
                            headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }
                        });
                        if (!global.hideSyncWarning) {
                            console.warn(`[Supabase Help] The 'last_synced_at' column is missing. Adding it will enable sync time tracking.`);
                            global.hideSyncWarning = true;
                        }
                    } catch (retryErr) {
                        console.error(`[AUTO-TRACKER] Background update failed ${channel.username} (Retry):`, retryErr.message);
                    }
                } else {
                    console.error(`[AUTO-TRACKER] Background update failed ${channel.username}:`, err.message);
                }
            }
        };

        for (let i = 0; i < channels.length; i += CONCURRENCY_LIMIT) {
            const batch = channels.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(c => processChannelHelper(c)));
        }

        // 3. Record Snapshot
        await recordSnapshot();
    } catch (error) {
        console.error('[TRACKER ERROR]', error.message);
    }
}

function startTracker(ms) {
    if (trackerTimer) clearInterval(trackerTimer);
    currentTrackerInterval = ms;
    trackerTimer = setInterval(runHourlyTracker, currentTrackerInterval);
    console.log(`[TRACKER] Started with interval: ${ms / 60000} minutes`);
}

// Endpoint to update tracker interval
app.post('/api/tracker/config', (req, res) => {
    const { intervalMs } = req.body;
    if (!intervalMs || isNaN(intervalMs)) {
        return res.status(400).json({ success: false, message: 'Invalid interval' });
    }
    startTracker(parseInt(intervalMs));
    res.json({ success: true, message: `Tracker interval updated to ${intervalMs / 60000} mins` });
});

// Update the manual snapshot endpoint to also SYNC first
app.post('/api/analytics', async (req, res) => {
    try {
        console.log('[MANUAL] Triggering sync before snapshot...');
        await runHourlyTracker(); // Reuse the same logic
        res.json({ success: true, message: 'Real-time sync and snapshot recorded.' });
    } catch (error) {
        console.error('Error recording analytics:', error.message);
        res.status(500).json({ success: false, message: 'Failed to record snapshot.' });
    }
});

// Initialize tracker on startup
startTracker(currentTrackerInterval);
setTimeout(runHourlyTracker, 5000); // Initial run

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
