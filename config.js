const Apify = require('apify');

// Browser configuration
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
    }
};

/**
 * Configures rate limiting for the scraper
 * @param {number} requestsPerSecond - Maximum requests per second
 * @returns {Object} - Rate limiter object
 */
function configureRateLimiting(requestsPerSecond = 5) {
    const intervalMs = 1000 / requestsPerSecond;
    let lastRequestTime = 0;
    
    return {
        waitForRateLimit: async function() {
            const now = Date.now();
            const elapsed = now - lastRequestTime;
            
            if (elapsed < intervalMs) {
                const delay = intervalMs - elapsed;
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
        return null;
    }
    
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
    return {
        withRetry: async function(operation, operationName = 'operation') {
            let lastError = null;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await operation();
                } catch (error) {
                    lastError = error;
                    
                    if (attempt < maxRetries) {
                        const backoffTime = 1000 * Math.pow(2, attempt - 1);
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
        handleInfiniteScroll: async function(page, maxScrolls = 10, scrollDelay = 2000) {
            let previousHeight;
            let scrollCount = 0;
            let noChangeCount = 0;
            
            while (scrollCount < maxScrolls && noChangeCount < 3) {
                previousHeight = await page.evaluate(() => document.body.scrollHeight);
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                scrollCount++;
                
                await page.waitForTimeout(scrollDelay);
                
                const newHeight = await page.evaluate(() => document.body.scrollHeight);
                
                if (newHeight === previousHeight) {
                    noChangeCount++;
                } else {
                    noChangeCount = 0;
                }
            }
        }
    };
}

module.exports = {
    config,
    configureRateLimiting,
    createProxyConfiguration,
    configureProxyRotation,
    configureRetryMechanism,
    configurePagination
};