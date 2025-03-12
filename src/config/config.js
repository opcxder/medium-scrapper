/**
 * @typedef {Object} RateLimit
 * @property {number} requestsPerMinute - Maximum number of requests per minute
 * @property {[number, number]} randomDelay - Range for random delay between requests [min, max] in seconds
 */

/**
 * @typedef {Object} ProxyConfig
 * @property {boolean} useProxy - Whether to use proxy servers
 * @property {string[]} proxyUrls - List of proxy URLs to rotate through
 */

/**
 * @typedef {Object} Config
 * @property {RateLimit} rateLimit - Rate limiting configuration
 * @property {ProxyConfig} proxy - Proxy configuration
 * @property {boolean} cacheEnabled - Whether to use caching
 * @property {boolean} recaptchaBypass - Whether to attempt reCAPTCHA bypass
 * @property {'exclude' | 'include-summary'} premiumHandling - How to handle premium articles
 * @property {'json' | 'csv' | 'xlsx'} outputFormat - Output format for scraped data
 * @property {string} cacheDir - Directory for caching data
 * @property {string} outputDir - Directory for output files
 */

/** @type {Config} */
const CONFIG = {
    // Rate limiting settings
    rateLimit: {
        requestsPerMinute: 30,
        randomDelay: [2, 5] // seconds
    },

    // Proxy settings
    proxy: {
        enabled: false,
        urls: [],
        currentIndex: 0
    },

    // Cache settings
    cache: {
        enabled: true,
        directory: 'data/cache',
        ttl: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    },

    // Output settings
    outputDir: 'data/output',
    outputFormat: 'json', // 'json', 'csv', or 'xlsx'

    // Scraping settings
    maxPosts: Infinity,
    includeArticleContent: true,
    premiumHandling: 'include-summary', // 'exclude' or 'include-summary'
    recaptchaBypass: false,

    // Browser settings
    browser: {
        headless: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    }
};

/**
 * Update configuration with user settings
 * @param {Object} userConfig - User provided configuration
 */
export function updateConfig(userConfig) {
    if (!userConfig) return;

    // Update rate limit settings
    if (userConfig.rateLimit) {
        CONFIG.rateLimit = {
            ...CONFIG.rateLimit,
            ...userConfig.rateLimit
        };
    }

    // Update proxy settings
    if (userConfig.proxy) {
        CONFIG.proxy = {
            ...CONFIG.proxy,
            ...userConfig.proxy
        };
    }

    // Update cache settings
    if (typeof userConfig.cacheEnabled === 'boolean') {
        CONFIG.cache.enabled = userConfig.cacheEnabled;
    }

    // Update output settings
    if (userConfig.outputFormat) {
        CONFIG.outputFormat = userConfig.outputFormat;
    }

    // Update scraping settings
    if (userConfig.maxPosts) {
        CONFIG.maxPosts = userConfig.maxPosts;
    }
    if (typeof userConfig.includeArticleContent === 'boolean') {
        CONFIG.includeArticleContent = userConfig.includeArticleContent;
    }
    if (userConfig.premiumHandling) {
        CONFIG.premiumHandling = userConfig.premiumHandling;
    }
    if (typeof userConfig.recaptchaBypass === 'boolean') {
        CONFIG.recaptchaBypass = userConfig.recaptchaBypass;
    }
}

/**
 * Validate configuration settings
 * @throws {Error} If configuration is invalid
 */
export function validateConfig() {
    // Validate rate limit
    if (CONFIG.rateLimit.requestsPerMinute < 1) {
        throw new Error('Rate limit must be at least 1 request per minute');
    }
    if (!Array.isArray(CONFIG.rateLimit.randomDelay) || 
        CONFIG.rateLimit.randomDelay.length !== 2 ||
        CONFIG.rateLimit.randomDelay[0] >= CONFIG.rateLimit.randomDelay[1]) {
        throw new Error('Random delay must be an array of [min, max] in seconds');
    }

    // Validate proxy settings
    if (CONFIG.proxy.enabled && (!Array.isArray(CONFIG.proxy.urls) || CONFIG.proxy.urls.length === 0)) {
        throw new Error('Proxy URLs must be provided when proxy is enabled');
    }

    // Validate output format
    if (!['json', 'csv', 'xlsx'].includes(CONFIG.outputFormat)) {
        throw new Error('Output format must be one of: json, csv, xlsx');
    }

    // Validate premium handling
    if (!['exclude', 'include-summary'].includes(CONFIG.premiumHandling)) {
        throw new Error('Premium handling must be one of: exclude, include-summary');
    }

    // Validate max posts
    if (typeof CONFIG.maxPosts === 'number' && CONFIG.maxPosts < 1) {
        throw new Error('Max posts must be greater than 0');
    }
}

export default CONFIG; 