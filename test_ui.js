const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        page.on('console', msg => console.log('CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));
        page.on('requestfailed', req => console.log('REQUEST_FAILED:', req.url(), req.failure() && req.failure().errorText));

        await page.goto('http://localhost:3000/dashboard.html', { waitUntil: 'networkidle0' });

        await browser.close();
    } catch (err) {
        console.error('SCRIPT_ERROR', err);
    }
})();
