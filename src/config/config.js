/**
 * @typedef {Object} ProxyConfig
 * @property {boolean} enabled - Whether to use proxy servers
 * @property {string[]} urls - List of proxy URLs to rotate through
 */

/**
 * @typedef {Object} Config
 * @property {number} requestsPerMinute - Maximum number of requests per minute
 * @property {string} delayRange - Random delay range between requests (format: "min,max")
 * @property {ProxyConfig} proxy - Proxy configuration
 * @property {boolean} cacheEnabled - Whether to use caching
 * @property {'exclude' | 'include-summary'} premiumHandling - How to handle premium articles
 * @property {'json' | 'csv' | 'xlsx'} outputFormat - Output format for scraped data
 * @property {string} cacheDir - Directory for caching data
 * @property {string} outputDir - Directory for output files
 */

/** @type {Config} */
const CONFIG = {
    // Rate limiting settings
    requestsPerMinute: 30,
    delayRange: '2,5', // seconds

    // Proxy settings
    proxy: {
        enabled: false,
        urls: []
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

    // Browser settings
    browser: {
        headless: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    },

    // Retry settings
    retry: {
        maxRetries: 3,
        initialDelay: 3000,
        maxDelay: 10000
    },

    // Navigation settings
    navigation: {
        timeout: 30000
    }
};

/**
 * Update configuration with user settings
 * @param {Object} userConfig - User provided configuration
 */
export function updateConfig(userConfig) {
    if (!userConfig) return;

    // Update rate limit settings
    if (userConfig.requestsPerMinute) {
        CONFIG.requestsPerMinute = userConfig.requestsPerMinute;
    }
    if (userConfig.delayRange) {
        CONFIG.delayRange = userConfig.delayRange;
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
}

/**
 * Validate configuration settings
 * @throws {Error} If configuration is invalid
 */
export function validateConfig() {
    // Validate rate limit
    if (CONFIG.requestsPerMinute < 1) {
        throw new Error('Rate limit must be at least 1 request per minute');
    }
    
    // Validate delay range format
    const [minDelay, maxDelay] = CONFIG.delayRange.split(',').map(Number);
    if (isNaN(minDelay) || isNaN(maxDelay) || minDelay >= maxDelay) {
        throw new Error('Delay range must be in format "min,max" where min < max');
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