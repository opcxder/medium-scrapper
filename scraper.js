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
        let retryCount = 0;
        const maxRetries = 3;
        const initialDelay = 5000;

        log.info('Starting to handle author page...');

        while (retryCount < maxRetries) {
            try {
                log.debug(`Attempt ${retryCount + 1}/${maxRetries} to process author page`);
                // Initial delay to let the page settle
                await delay(initialDelay + (retryCount * 2000));
                log.debug('Initial delay completed, checking page content...');

                // Check for cloudflare or other protection pages
                const pageContent = await page.content();
                log.debug('Retrieved page content for security check');
                if (pageContent.includes('security check') || pageContent.includes('cloudflare')) {
                    log.warning('Security check or Cloudflare protection detected');
                    throw new Error('Security check detected');
                }
                log.debug('No security checks detected, proceeding with page load');

                log.info('Waiting for page content to load...');
                // Enhanced page loading detection with multiple fallbacks
                await Promise.race([
                    Promise.all([
                        page.waitForSelector(config.selectors.articleCard, { 
                            timeout: 120000, 
                            state: 'attached',
                            visible: true 
                        }),
                        page.waitForFunction(
                            () => document.readyState === 'complete' && 
                                  window.performance.timing.loadEventEnd > 0 && 
                                  !document.querySelector('.progressBar'),
                            { timeout: 60000 }
                        )
                    ]),
                    page.waitForSelector('div[role="alert"]', { timeout: 120000 })
                        .then(() => {
                            throw new Error('Page access denied or rate limited');
                        })
                ]);

                // Additional verification for content loading
                log.debug('Verifying article content presence...');
                const articles = await page.$$(config.selectors.articleCard);
                if (!articles || articles.length === 0) {
                    log.warning('No articles found on the page after load');
                    throw new Error('No articles found after page load');
                }
                log.info(`Found ${articles.length} article cards on the page`);

            log.info('Starting infinite scroll process...');
                await this.handleInfiniteScroll(page);
                log.debug('Infinite scroll completed');
            
            log.info('Extracting article URLs...');
            // Enhanced article URL extraction with validation
            const articleUrls = await page.$$eval(config.selectors.articleCard, articles => {
                return articles.reduce((urls, article) => {
                    const links = article.querySelectorAll('a[href*="/p/"], a[href*="/@"]');
                    links.forEach(link => {
                        const url = link.href;
                        if (url && url.includes('medium.com') && !urls.includes(url)) {
                            urls.push(url);
                        }
                    });
                    return urls;
                }, []);
            });

            if (articleUrls.length === 0) {
                log.warning('No valid article URLs found after extraction');
                throw new Error('No valid article URLs found');
            }

            log.info(`Successfully extracted ${articleUrls.length} article URLs to process`);

            log.info('Starting to enqueue article pages...');
            // Enqueue article pages with improved rate limiting
            for (const url of articleUrls) {
                if (this.input.maxPosts > 0 && this.articles.length >= this.input.maxPosts) {
                    break;
                }
                await this.crawler.addRequests([{
                    url,
                    userData: { isArticle: true }
                }]);
                // Increased delay between requests
                await randomDelay(config.rateLimit.minDelay * 2, config.rateLimit.maxDelay * 2);
            }
                retryCount = 0;
                break; // Success - exit retry loop
            } catch (error) {
                retryCount++;
                log.warning(`Attempt ${retryCount}/${maxRetries} failed: ${error.message}`);
                log.debug(`Error details: ${error.stack || error}`);
                
                if (retryCount >= maxRetries) {
                    log.error('Failed to process author page after all retries:', error);
                    throw error;
                }
                
                // Exponential backoff
                await delay(Math.pow(2, retryCount) * 5000);
            }
        }
    }
    async handleInfiniteScroll(page) {
        let previousHeight = 0;
        let scrollAttempts = 0;
        let retryCount = 0;
        const maxRetries = 5; // Increased max retries
        const maxScrollAttempts = this.input.maxPosts > 0 ? Math.ceil(this.input.maxPosts / 10) : 30;
        const minScrollDelay = 3000; // Increased minimum delay between scrolls

        log.info(`Starting infinite scroll process (max attempts: ${maxScrollAttempts})`);

        while (scrollAttempts < maxScrollAttempts) {
            try {
                log.debug(`Scroll attempt ${scrollAttempts + 1}/${maxScrollAttempts}`);
                // Check for rate limiting or blocking elements
                const isBlocked = await page.$('div[role="alert"]');
                if (isBlocked) {
                    log.warning('Rate limiting or blocking detected during scroll');
                    throw new Error('Rate limited or blocked');
                }

                log.debug('Performing scroll operation...');
                // Scroll with natural behavior
                await page.evaluate(async () => {
                    const distance = Math.floor(Math.random() * 100) + 100;
                    window.scrollBy(0, distance);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    window.scrollTo(0, document.body.scrollHeight);
                });

                log.debug('Waiting for content to load after scroll...');
                // Wait longer for content to load
                await delay(minScrollDelay + Math.random() * 2000);

                // Verify content loaded
                const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                const articles = await page.$$(config.selectors.articleCard);
                log.debug(`Current page height: ${currentHeight}, Previous height: ${previousHeight}`);
                log.debug(`Found ${articles.length} articles after scroll`);
                
                if (currentHeight === previousHeight && articles.length > 0) {
                    log.info('Possible end of content reached, performing final check...');
                    // Double check if we really reached the bottom
                    await delay(5000);
                    const finalCheck = await page.evaluate(() => document.body.scrollHeight);
                    if (finalCheck === currentHeight) {
                        log.info('End of content confirmed, stopping infinite scroll');
                        break;
                    }
                    log.debug('Content height changed after final check, continuing scroll');

                previousHeight = currentHeight;
                scrollAttempts++;
                retryCount = 0;

                const articleCount = articles.length;
                if (this.input.maxPosts > 0 && articleCount >= this.input.maxPosts) {
                    break;
                }

                await randomDelay(config.rateLimit.minDelay * 2, config.rateLimit.maxDelay * 2);
            } catch (error) {
                retryCount++;
                log.warning('Scroll error:', { error: error.message, retryCount });
                
                if (retryCount >= maxRetries) {
                    log.warning('Max retries reached during infinite scroll, moving on...');
                    break;
                }
                
                // Exponential backoff with longer delays
                const backoffTime = 5000 * Math.pow(2, retryCount);
                await delay(backoffTime);
            }
        }
    }

    async handleArticlePage(page, request) {
        let retryCount = 0;
        const maxRetries = 5;

        log.info('Starting to handle article page...', { url: request.url });

        while (retryCount < maxRetries) {
            try {
                log.debug(`Attempt ${retryCount + 1}/${maxRetries} to process article page`);
                // Check for rate limiting or blocking
                const isBlocked = await page.$('div[role="alert"]');
                if (isBlocked) {
                    log.warning('Rate limiting or blocking detected');
                    throw new Error('Rate limited or blocked');
                }
                log.debug('No rate limiting detected, proceeding with content extraction');

                log.info('Waiting for article content to load...');
                // Wait for article content with increased timeout
                await Promise.race([
                    page.waitForSelector('article', { timeout: 60000, state: 'attached' })
                        .then(() => log.debug('Article content loaded successfully')),
                    page.waitForSelector('div[role="alert"]', { timeout: 60000 }).then(() => {
                        log.warning('Page access denied or rate limited during content load');
                        throw new Error('Page access denied or rate limited');
                    })
                ]);

                log.debug('Waiting for complete page load...');
                // Ensure all content is loaded
                await page.waitForFunction(
                    () => document.readyState === 'complete' && 
                          !document.querySelector('.progressBar'),
                    { timeout: 30000 }
                );
                log.debug('Page fully loaded, checking premium status');

                const isPremium = await page.$(config.selectors.premiumIndicator) !== null;
                log.debug(`Article premium status: ${isPremium}`);
                
                log.info('Starting article data extraction...');
                // Add random delay before extraction
                await randomDelay(2000, 4000);
                
                log.debug('Extracting article metadata...');
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

                log.info('Article data extracted successfully');
                this.articles.push(formatArticleData(articleData));
                log.debug('Article added to collection');
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