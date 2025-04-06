const { Actor } = require('apify');
const { PlaywrightCrawler } = require('@crawlee/playwright');
const config = require('./config');
const {
    delay,
    randomDelay,
    cleanText,
    formatArticleData,
    isValidUrl
} = require('./utils');

const { log } = Actor;

class MediumScraper {
    constructor(input) {
        this.input = input;
        this.crawler = null;
        this.articles = [];
    }

    async initialize() {
        // Initialize proxy configuration
        const proxyConfiguration = this.input.useProxy ? await config.createProxyConfiguration(true) : undefined;
        
        // Initialize the crawler
        this.crawler = new PlaywrightCrawler({
            launchContext: {
                launchOptions: {
                    ...config.browser,
                    product: 'firefox',
                    timeout: 180000, // Increase browser launch timeout to 3 minutes
                    ignoreHTTPSErrors: true,
                    bypassCSP: true
                },
            },
            proxyConfiguration,
            requestHandlerTimeoutSecs: 180, // Increase request timeout to 3 minutes
            maxRequestRetries: 5, // Increase retry attempts
            navigationTimeoutSecs: 120, // Set navigation timeout to 2 minutes
            preNavigationHooks: [
                async (crawlingContext, gotoOptions) => {
                    const { page } = crawlingContext;
                    // Enhanced stealth mode
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => false });
                        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                        Object.defineProperty(navigator, 'vendor', { get: () => 'Mozilla' });
                        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
                        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
                        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                        window.navigator.permissions.query = (param) => Promise.resolve({ state: 'granted' });
                    });
                    // Set navigation options
                    gotoOptions.waitUntil = 'networkidle';
                    gotoOptions.timeout = 120000;
                }
            ],
            requestHandler: async (context) => {
                const { page, request } = context;
                // Set default timeout for operations
                page.setDefaultTimeout(120000);
                
                // Set custom user agent
                await page.setExtraHTTPHeaders({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Upgrade-Insecure-Requests': '1'
                });

                // Enable request interception with enhanced filtering
                await page.route('**/*', async route => {
                    const request = route.request();
                    const resourceType = request.resourceType();
                    
                    if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media' || resourceType === 'other') {
                        await route.abort();
                    } else if (resourceType === 'script' && !request.url().includes('medium.com')) {
                        await route.abort();
                    } else {
                        await route.continue();
                    }
                });
                
                if (request.userData.isArticle) {
                    await this.handleArticlePage(page, request);
                } else {
                    await this.handleAuthorPage(page);
                }
            },
            maxRequestsPerCrawl: this.input.maxPosts > 0 ? this.input.maxPosts + 1 : undefined,
            maxConcurrency: 1, // To respect rate limits
        });
    }

    async scrapeArticles() {
        if (!isValidUrl(this.input.authorUrl)) {
            throw new Error('Invalid Medium author URL provided');
        }

        try {
            await this.crawler.run([{
                url: this.input.authorUrl,
                userData: { isArticle: false }
            }]);
            return this.articles;
        } catch (error) {
            log.error('Error scraping articles:', error);
            throw error;
        }
    }

    async handleAuthorPage(page) {
        try {
            // Wait for initial content to load
            await page.waitForSelector(config.selectors.articleCard, { timeout: 60000 });
            await this.handleInfiniteScroll(page);
            
            const articleUrls = await page.$$eval(config.selectors.articleCard, articles => 
                articles.map(article => {
                    const link = article.querySelector('a');
                    return link ? link.href : null;
                }).filter(url => url)
            );

        // Enqueue article pages
        for (const url of articleUrls) {
            if (this.input.maxPosts > 0 && this.articles.length >= this.input.maxPosts) {
                break;
            }
            await this.crawler.addRequests([{
                url,
                userData: { isArticle: true }
            }]);
            await randomDelay(config.rateLimit.minDelay, config.rateLimit.maxDelay);
        }
    }

    async handleInfiniteScroll(page) {
        let previousHeight = 0;
        let scrollAttempts = 0;
        let retryCount = 0;
        const maxRetries = 3;
        const maxScrollAttempts = this.input.maxPosts > 0 ? Math.ceil(this.input.maxPosts / 10) : 30;

        while (scrollAttempts < maxScrollAttempts) {
            try {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await delay(2000 * Math.pow(2, retryCount)); // Exponential backoff

                const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                if (currentHeight === previousHeight) {
                    break;
                }

                previousHeight = currentHeight;
                scrollAttempts++;
                retryCount = 0; // Reset retry count on successful scroll

                const articleCount = await page.$$eval(config.selectors.articleCard, articles => articles.length);
                if (this.input.maxPosts > 0 && articleCount >= this.input.maxPosts) {
                    break;
                }

                await randomDelay(config.rateLimit.minDelay, config.rateLimit.maxDelay);
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    log.warning('Max retries reached during infinite scroll, moving on...');
                    break;
                }
                log.debug('Scroll failed, retrying with backoff...', { retryCount });
                await delay(1000 * Math.pow(2, retryCount)); // Exponential backoff for errors
            }
        }
    }

    async handleArticlePage(page, request) {
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                await page.waitForSelector('article', { timeout: 30000 });
                const isPremium = await page.$(config.selectors.premiumIndicator) !== null;
                
                const articleData = {
                title: await page.$eval(config.selectors.title, el => el.textContent),
                author: await page.$eval(config.selectors.author, el => el.textContent),
                url: request.url,
                is_premium: isPremium,
                tags: await page.$$eval(config.selectors.tags, tags => 
                    tags.map(tag => tag.textContent.toLowerCase())
                )
            };

            if (this.input.includePublication) {
                try {
                    articleData.publication = await page.$eval(
                        config.selectors.publicationName,
                        el => el.textContent
                    );
                } catch {
                    articleData.publication = null;
                }
            }

            if (this.input.includeContent) {
                articleData.content = await page.$eval(
                    config.selectors.content,
                    el => el.textContent
                );
            }

            if (this.input.includeComments) {
                articleData.comments = await this.extractComments(page);
            }

                this.articles.push(formatArticleData(articleData));
                break; // Success - exit retry loop
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    log.error(`Failed to extract article data after ${maxRetries} attempts: ${error.message}`);
                    break;
                }
                log.warning(`Retry ${retryCount}/${maxRetries} for article extraction: ${error.message}`);
                await delay(2000 * Math.pow(2, retryCount)); // Exponential backoff
            }
        }
    }

    async extractComments(page) {
        try {
            const comments = await page.$$(config.selectors.comments);
            return await Promise.all(comments.map(async comment => ({
                user: await comment.$eval('[data-testid="authorName"]', el => el.textContent),
                comment: cleanText(await comment.$eval('[data-testid="commentContent"]', el => el.textContent)),
                likes: parseInt(await comment.$eval('[data-testid="likesCount"]', el => el.textContent) || '0')
            })));
        } catch {
            return [];
        }
    }

    async close() {
        if (this.crawler) {
            await this.crawler.teardown();
        }
    }
}

module.exports = MediumScraper;