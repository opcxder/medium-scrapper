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
        // Initialize the crawler
        this.crawler = new PlaywrightCrawler({
            browserPoolOptions: {
                ...config.browser,
                useChrome: true,
                proxyUrl: this.input.useProxy ? process.env.APIFY_PROXY_URL : undefined
            },
            preNavigationHooks: [
                async (crawlingContext, gotoOptions) => {
                    const { page } = crawlingContext;
                    // Set stealth mode
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => false });
                        window.chrome = { runtime: {} };
                    });
                }
            ],
            requestHandler: async (context) => {
                const { page, request } = context;
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
        const maxScrollAttempts = this.input.maxPosts > 0 ? Math.ceil(this.input.maxPosts / 10) : 30;

        while (scrollAttempts < maxScrollAttempts) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await delay(1000);

            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight) {
                break;
            }

            previousHeight = currentHeight;
            scrollAttempts++;

            const articleCount = await page.$$eval(config.selectors.articleCard, articles => articles.length);
            if (this.input.maxPosts > 0 && articleCount >= this.input.maxPosts) {
                break;
            }

            await randomDelay(config.rateLimit.minDelay, config.rateLimit.maxDelay);
        }
    }

    async handleArticlePage(page, request) {
        try {
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
        } catch (error) {
            log.error(`Error extracting article data: ${error.message}`);
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