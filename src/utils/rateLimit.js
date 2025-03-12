import CONFIG from '../config/config.js';

class RateLimiter {
    constructor(requestsPerMinute) {
        this.requestsPerMinute = requestsPerMinute;
        this.tokens = requestsPerMinute;
        this.lastRefill = Date.now();
    }

    async waitForToken() {
        await this.refillTokens();
        
        if (this.tokens < 1) {
            const waitTime = (60 / this.requestsPerMinute) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            await this.refillTokens();
        }

        this.tokens -= 1;
    }

    async refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const refillAmount = (timePassed / 60000) * this.requestsPerMinute;

        this.tokens = Math.min(this.requestsPerMinute, this.tokens + refillAmount);
        this.lastRefill = now;
    }
}

/**
 * Creates a delay between requests with random jitter
 * @param {number} min - Minimum delay in seconds
 * @param {number} max - Maximum delay in seconds
 * @returns {Promise<void>}
 */
export async function randomDelay(min, max) {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
}

const rateLimiter = new RateLimiter(CONFIG.rateLimit.requestsPerMinute);

/**
 * Rate limits requests using token bucket algorithm
 * @returns {Promise<void>}
 */
export async function rateLimit() {
    await rateLimiter.waitForToken();
    await randomDelay(...CONFIG.rateLimit.randomDelay);
}

export default {
    rateLimit,
    randomDelay
}; 