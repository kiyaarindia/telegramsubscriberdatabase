const axios = require('axios');
const cheerio = require('cheerio');

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

async function testScrapeAndSave(channelIdentifier) {
    console.log(`\n--- TESTING CHANNEL: ${channelIdentifier} ---`);

    let username = channelIdentifier;
    if (channelIdentifier.includes('t.me/')) {
        const parts = channelIdentifier.split('t.me/');
        username = parts[1].split('/')[0].split('?')[0];
    }
    username = username.replace('@', '').trim();

    console.log(`Derived Username: ${username}`);
    const scrapeUrl = `https://t.me/${username}`;

    try {
        console.log(`[1] Scraping URL: ${scrapeUrl}`);
        const response = await axios.get(scrapeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });

        console.log(`[1] Scrape Status: ${response.status}`);
        const html = response.data;
        const $ = cheerio.load(html);

        const name = $('div.tgme_page_title').text().trim();
        const subscribers = $('div.tgme_page_extra').text().trim();
        const description = $('div.tgme_page_description').text().trim();
        const image_url = $('img.tgme_page_photo_image').attr('src');

        console.log(`[1] Extracted: Name="${name}", Subs="${subscribers}"`);

        if (!name) {
            console.error('❌ FAILED: Name not found in scraped page.');
            return;
        }

        const channelData = {
            name,
            subscribers,
            username,
            description,
            avatar_url: image_url,
            added_on: new Date().toISOString()
            // last_updated: new Date().toISOString() -- CAUSING ERROR: Column does not exist
        };

        console.log('[2] Attempting Supabase Upsert...');
        const upsertResponse = await db_api.post('/channels', channelData);

        console.log(`[2] Supabase Status: ${upsertResponse.status}`);
        console.log('✅ SUCCESS: Channel scraped and saved!');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('Response Status:', error.response.status);
        }
    }
}

// Test with a known valid channel
testScrapeAndSave('https://t.me/durov');
