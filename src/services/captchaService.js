import CONFIG from '../config/config.js';

class CaptchaService {
    constructor() {
        this.provider = null;
        this.apiKey = process.env.CAPTCHA_API_KEY;
    }

    /**
     * Initialize the CAPTCHA service
     * @throws {Error} If CAPTCHA bypass is enabled but no API key is provided
     */
    init() {
        if (CONFIG.recaptchaBypass && !this.apiKey) {
            throw new Error('CAPTCHA_API_KEY environment variable must be set when recaptchaBypass is enabled');
        }
    }

    /**
     * Detect if a page has a CAPTCHA
     * @param {import('playwright').Page} page - Playwright page object
     * @returns {Promise<boolean>} Whether a CAPTCHA is present
     */
    async detectCaptcha(page) {
        const captchaSelectors = [
            'iframe[src*="recaptcha"]',
            'iframe[src*="hcaptcha"]',
            '.g-recaptcha',
            '#captcha',
            '[class*="captcha"]'
        ];

        for (const selector of captchaSelectors) {
            if (await page.$(selector)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Solve a CAPTCHA on a page
     * @param {import('playwright').Page} page - Playwright page object
     * @returns {Promise<boolean>} Whether the CAPTCHA was solved successfully
     */
    async solveCaptcha(page) {
        if (!CONFIG.recaptchaBypass || !this.apiKey) {
            console.warn('CAPTCHA detected but bypass is disabled or no API key provided');
            return false;
        }

        try {
            // Get the CAPTCHA site key
            const siteKey = await page.evaluate(() => {
                const recaptchaElement = document.querySelector('.g-recaptcha');
                return recaptchaElement ? recaptchaElement.getAttribute('data-sitekey') : null;
            });

            if (!siteKey) {
                console.warn('Could not find reCAPTCHA site key');
                return false;
            }

            // Here you would integrate with your preferred CAPTCHA solving service
            // This is a placeholder for the actual implementation
            console.log('Attempting to solve CAPTCHA...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Simulate CAPTCHA solution (replace with actual service integration)
            await page.evaluate(() => {
                // This would be replaced with actual CAPTCHA solution
                console.log('CAPTCHA solution simulated');
            });

            // Verify the CAPTCHA was solved
            const captchaStillPresent = await this.detectCaptcha(page);
            if (captchaStillPresent) {
                console.warn('CAPTCHA solution failed or new CAPTCHA appeared');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error solving CAPTCHA:', error);
            return false;
        }
    }

    /**
     * Handle CAPTCHA detection and solving
     * @param {import('playwright').Page} page - Playwright page object
     * @returns {Promise<boolean>} Whether the page is ready to proceed
     */
    async handleCaptcha(page) {
        const hasCaptcha = await this.detectCaptcha(page);
        if (!hasCaptcha) {
            return true;
        }

        console.log('CAPTCHA detected, attempting to solve...');
        const solved = await this.solveCaptcha(page);
        
        if (!solved) {
            console.warn('Failed to solve CAPTCHA');
            return false;
        }

        // Wait for page to settle after CAPTCHA solution
        await page.waitForTimeout(2000);
        return true;
    }
}

// Create and initialize CAPTCHA service
const captchaService = new CaptchaService();
captchaService.init();

export default captchaService; 