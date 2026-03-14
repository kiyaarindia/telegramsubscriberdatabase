const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeChannelData(username) {
    const scrapeUrl = `https://t.me/s/${username}?t=${Date.now()}`;
    const response = await axios.get(scrapeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 15000
    });

    const $ = cheerio.load(response.data);

    // Debugging: Log the HTML of the likely image container
    const photoContainer = $('.tgme_page_photo_image');
    console.log(`Container found: ${photoContainer.length > 0}`);
    if (photoContainer.length > 0) {
        console.log(`Container HTML: ${photoContainer.parent().html().substring(0, 500)}`);
    }

    let image_url = '';

    // Method 1: background-image style
    const style = photoContainer.attr('style');
    if (style && style.includes('background-image')) {
        const match = style.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1]) {
            image_url = match[1];
        }
    }

    // Method 2: img inside container
    if (!image_url) {
        image_url = photoContainer.find('img').attr('src');
    }

    // Method 3: img with class
    if (!image_url) {
        image_url = $('img.tgme_page_photo_image').attr('src');
    }

    return { image_url };
}

async function test() {
    const usernames = ['godfather_wholesale'];
    for (const user of usernames) {
        try {
            const data = await scrapeChannelData(user);
            console.log(`User: ${user}`);
            console.log(`Final Image URL: ${data.image_url}`);
            console.log('---');
        } catch (e) {
            console.error(`Error for ${user}: ${e.message}`);
        }
    }
}

test();
