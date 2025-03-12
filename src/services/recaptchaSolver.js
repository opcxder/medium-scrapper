import { Solver } from '2captcha';
import CONFIG from '../config/config.js';
import { retry } from '../utils/retry.js';

export class RecaptchaSolver {
    constructor() {
        if (!CONFIG.recaptcha?.apiKey) {
            throw new Error('2captcha API key is required for reCAPTCHA solving');
        }
        
        this.solver = new Solver(CONFIG.recaptcha.apiKey);
    }

    /**
     * Solve reCAPTCHA on the page
     * @param {import('playwright').Page} page - Playwright page object
     */
    async solve(page) {
        try {
            // Find reCAPTCHA sitekey
            const sitekey = await page.evaluate(() => {
                const iframe = document.querySelector('iframe[src*="recaptcha/api2/anchor"]');
                if (!iframe) return null;
                const url = new URL(iframe.src);
                return url.searchParams.get('k');
            });

            if (!sitekey) {
                throw new Error('Could not find reCAPTCHA sitekey');
            }

            // Get the page URL
            const pageUrl = page.url();

            // Solve reCAPTCHA using 2captcha
            console.log('Solving reCAPTCHA...');
            const result = await retry(async () => {
                const { data } = await this.solver.recaptcha({
                    sitekey,
                    url: pageUrl,
                    version: 'v2'
                });
                return data;
            }, {
                maxRetries: 5,
                initialDelay: 2000,
                maxDelay: 30000
            });

            // Insert the solution
            await page.evaluate((token) => {
                window.grecaptcha.getResponse = () => token;
                window.grecaptcha.execute();
            }, result);

            // Wait for navigation or success indicator
            await Promise.race([
                page.waitForNavigation({ timeout: 10000 }),
                page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 })
            ]);

            console.log('reCAPTCHA solved successfully');
        } catch (error) {
            console.error('Failed to solve reCAPTCHA:', error);
            throw error;
        }
    }
} 