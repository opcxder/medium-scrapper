const { chromium } = require('playwright');
const { Actor } = require('apify');
const config = require('./config');
const {
    delay,
    randomDelay,
    cleanText,
    formatArticleData,
    isValidUrl
} = require('./utils');

class MediumScraper {
    constructor(input) {
        this.input = input;
        this.browser = null;
        this.page = null;
        this.articles = [];
    }

    async initialize() {
        // Launch browser with stealth configuration
        this.browser = await chromium.launch({
            ...config.browser,
            proxy: this.input.useProxy ? {
                server: process.env.APIFY_PROXY_URL
            } : undefined
        });

        this.page = await this.browser.newPage();
        
        // Set stealth mode
        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            window.chrome = { runtime: {} };
        });
    }

    async scrapeArticles() {
        if (!isValidUrl(this.input.authorUrl)) {
            throw new Error('Invalid Medium author URL provided');
        }

        try {
            await this.page.goto(this.input.authorUrl, { waitUntil: 'networkidle' });
            await this.handleInfiniteScroll();
            const articles = await this.extractArticles();
            return articles;
        } catch (error) {
            console.error('Error scraping articles:', error);
            throw error;
        }
    }

    async handleInfiniteScroll() {
        let previousHeight = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = this.input.maxPosts > 0 ? Math.ceil(this.input.maxPosts / 10) : 30;

        while (scrollAttempts < maxScrollAttempts) {
            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await delay(1000);

            const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight) {
                break;
            }

            previousHeight = currentHeight;
            scrollAttempts++;

            // Check if we have enough articles
            const articleCount = await this.page.$$eval(config.selectors.articleCard, articles => articles.length);
            if (this.input.maxPosts > 0 && articleCount >= this.input.maxPosts) {
                break;
            }

            await randomDelay(config.rateLimit.minDelay, config.rateLimit.maxDelay);
        }
    }

    async extractArticles() {
        const articles = await this.page.$$(config.selectors.articleCard);
        const extractedArticles = [];

        for (let i = 0; i < articles.length; i++) {
            if (this.input.maxPosts > 0 && extractedArticles.length >= this.input.maxPosts) {
                break;
            }

            const article = articles[i];
            const articleData = await this.extractArticleData(article);
            
            if (articleData) {
                // Filter by tags if specified
                if (this.input.tags && this.input.tags.length > 0) {
                    const hasMatchingTag = articleData.tags.some(tag => 
                        this.input.tags.includes(tag.toLowerCase())
                    );
                    if (!hasMatchingTag) continue;
                }

                extractedArticles.push(articleData);
            }

            await randomDelay(config.rateLimit.minDelay, config.rateLimit.maxDelay);
        }

        return extractedArticles;
    }

    async extractArticleData(articleElement) {
        try {
            const url = await articleElement.$eval('a', a => a.href);
            
            // Navigate to article page
            await this.page.goto(url, { waitUntil: 'networkidle' });
            
            const isPremium = await this.page.$(config.selectors.premiumIndicator) !== null;
            
            const articleData = {
                title: await this.page.$eval(config.selectors.title, el => el.textContent),
                author: await this.page.$eval(config.selectors.author, el => el.textContent),
                url: url,
                is_premium: isPremium,
                tags: await this.page.$$eval(config.selectors.tags, tags => 
                    tags.map(tag => tag.textContent.toLowerCase())
                )
            };

            if (this.input.includePublication) {
                try {
                    articleData.publication = await this.page.$eval(
                        config.selectors.publicationName,
                        el => el.textContent
                    );
                } catch {
                    articleData.publication = null;
                }
            }

            if (this.input.includeContent) {
                articleData.content = await this.page.$eval(
                    config.selectors.content,
                    el => el.textContent
                );
            }

            if (this.input.includeComments) {
                articleData.comments = await this.extractComments();
            }

            return formatArticleData(articleData);
        } catch (error) {
            console.error(`Error extracting article data: ${error.message}`);
            return null;
        }
    }

    async extractComments() {
        try {
            const comments = await this.page.$$(config.selectors.comments);
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
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = MediumScraper;