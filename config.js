const Apify = require('apify');
const { log } = Apify.utils;

/**
 * Configures rate limiting for the scraper
 * @param {number} requestsPerSecond - Maximum requests per second
 * @returns {Object} - Rate limiter object
 */
function configureRateLimiting(requestsPerSecond = 5) {
    log.info(`Setting up rate limiting: ${requestsPerSecond} requests per second`);
    
    const intervalMs = 1000 / requestsPerSecond;
    let lastRequestTime = 0;
    
    return {
        /**
         * Waits until the rate limit allows a new request
         */
        waitForRateLimit: async function() {
            const now = Date.now();
            const elapsed = now - lastRequestTime;
            
            if (elapsed < intervalMs) {
                const delay = intervalMs - elapsed;
                log.debug(`Rate limiting: waiting ${delay}ms before next request`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            lastRequestTime = Date.now();
        }
    };
}

/**
 * Creates proxy configuration for the scraper
 * @param {boolean} useProxies - Whether to use proxies
 * @returns {Promise<Object|null>} - Proxy configuration object or null
 */
async function createProxyConfiguration(useProxies = true) {
    if (!useProxies) {
        log.info('Proxies disabled, running with direct connection');
        return null;
    }
    
    log.info('Setting up proxy configuration');
    
    // Create and return proxy configuration
    return await Apify.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
        countryCode: 'US'
    });
}

/**
 * Configure smart proxy rotation
 * @param {Object} proxyConfiguration - Proxy configuration object
 * @returns {Function} - Function to get a new proxy URL
 */
function configureProxyRotation(proxyConfiguration) {
    if (!proxyConfiguration) {
        return () => null;
    }
    
    return async function getNewProxy() {
        return await proxyConfiguration.newUrl();
    };
}

/**
 * Configure retry mechanism for failed requests
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Object} - Retry mechanism object
 */
function configureRetryMechanism(maxRetries = 3) {
    log.info(`Setting up retry mechanism with ${maxRetries} max retries`);
    
    return {
        /**
         * Handles a failed request with retries
         * @param {Function} operation - Async function to retry
         * @param {string} operationName - Name of the operation for logging
         * @returns {Promise<*>} - Result of the operation
         */
        withRetry: async function(operation, operationName = 'operation') {
            let lastError = null;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    log.debug(`Attempt ${attempt}/${maxRetries} for ${operationName}`);
                    return await operation();
                } catch (error) {
                    lastError = error;
                    log.warning(`Attempt ${attempt}/${maxRetries} for ${operationName} failed: ${error.message}`);
                    
                    if (attempt < maxRetries) {
                        // Exponential backoff
                        const backoffTime = 1000 * Math.pow(2, attempt - 1);
                        log.debug(`Waiting ${backoffTime}ms before next retry`);
                        await new Promise(resolve => setTimeout(resolve, backoffTime));
                    }
                }
            }
            
            throw new Error(`All ${maxRetries} attempts for ${operationName} failed. Last error: ${lastError.message}`);
        }
    };
}

/**
 * Configure pagination for infinite scroll
 * @returns {Object} - Pagination handling object
 */
function configurePagination() {
    return {
        /**
         * Handles infinite scroll pagination
         * @param {Object} page - Playwright page object
         * @param {number} maxScrolls - Maximum number of scrolls
         * @param {number} scrollDelay - Delay between scrolls in ms
         * @returns {Promise<void>}
         */
        handleInfiniteScroll: async function(page, maxScrolls = 10, scrollDelay = 2000) {
            log.info(`Handling infinite scroll: max ${maxScrolls} scrolls, ${scrollDelay}ms delay`);
            
            let previousHeight;
            let scrollCount = 0;
            let noChangeCount = 0;
            
            while (scrollCount < maxScrolls && noChangeCount < 3) {
                // Get current scroll height
                previousHeight = await page.evaluate(() => document.body.scrollHeight);
                
                // Scroll down
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                scrollCount++;
                
                // Wait for page to load new content
                await page.waitForTimeout(scrollDelay);
                
                // Get new scroll height
                const newHeight = await page.evaluate(() => document.body.scrollHeight);
                
                // Check if the page height has changed
                if (newHeight === previousHeight) {
                    noChangeCount++;
                    log.debug(`No change in scroll height (${noChangeCount}/3)`);
                } else {
                    noChangeCount = 0;
                    log.debug(`Scrolled successfully: ${scrollCount}/${maxScrolls}`);
                }
            }
            
            log.info(`Infinite scroll completed after ${scrollCount} scrolls`);
        }
    };
}

const config = {
    // Browser configuration
    browser: {
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
        ],
    },

    // Selectors for Medium
    selectors: {
        articleCard: 'article',
        title: 'h1',
        content: 'article section',
        author: '[data-testid="authorName"]',
        publicationName: '[data-testid="publicationName"]',
        tags: '[data-testid="postTags"] a',
        comments: '[data-testid="responses"]',
        premiumIndicator: '[data-testid="storyPremiumLabel"]',
        loadMoreButton: 'button[data-testid="loadMore"]',
    },

    // GraphQL endpoints
    graphql: {
        postEndpoint: 'https://medium.com/_/graphql',
        userEndpoint: 'https://medium.com/_/api/users',
    },

    // Rate limiting
    rateLimit: {
        minDelay: 1000,
        maxDelay: 3000,
    },

    // Output formats
    outputFormats: ['json', 'csv', 'xlsx'],

    // Proxy configuration
    proxy: {
        useApifyProxy: true,
        groups: ['RESIDENTIAL'],
    },
};

module.exports = config;