import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import CONFIG from '../config/config.js';
import { retry } from '../utils/retry.js';
import { Author } from '../models/Author.js';
import { Post } from '../models/Post.js';

export class MediumScraper {
    constructor(options = {}) {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.maxPosts = options.maxPosts || CONFIG.maxPosts;
        this.includeArticleContent = options.includeArticleContent ?? CONFIG.includeArticleContent;
        this.lastRequestTime = 0;
    }

    /**
     * Initialize the scraper with error handling
     */
    async init() {
        try {
            // Check if running in Apify or Docker environment
            const isApify = process.env.APIFY_TOKEN || process.env.APIFY;
            const isDocker = process.env.NODE_ENV === 'production';
            const isWindows = process.platform === 'win32';
            
            // Launch browser with configured options
            this.browser = await retry(async () => {
                const launchOptions = {
                    headless: true,
                    args: [
                        '--disable-dev-shm-usage',
                        '--no-sandbox',
                        '--disable-setuid-sandbox'
                    ]
                };

                if (isApify) {
                    // Use Apify's browser pool
                    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
                } else if (isDocker) {
                    // Use globally installed Playwright in Docker
                    if (isWindows) {
                        launchOptions.executablePath = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH || '', 'chromium', 'chrome.exe');
                    } else {
                        launchOptions.channel = 'chromium';
                    }
                } else {
                    // Local environment
                    launchOptions.args.push('--disable-gpu', '--disable-web-security');
                    launchOptions.headless = CONFIG.browser.headless;
                }

                return await chromium.launch(launchOptions);
            });

            // Create new context with configured options
            this.context = await retry(async () => {
                const context = await this.browser.newContext({
                    userAgent: CONFIG.browser.userAgent,
                    viewport: CONFIG.browser.viewport,
                    ignoreHTTPSErrors: true
                });

                // Use Apify Proxy if available
                if (isApify && process.env.APIFY_PROXY_URL) {
                    await context.setProxy({
                        server: process.env.APIFY_PROXY_URL
                    });
                } else if (CONFIG.proxy?.enabled && CONFIG.proxy.urls.length > 0) {
                    const proxy = CONFIG.proxy.urls[Math.floor(Math.random() * CONFIG.proxy.urls.length)];
                    await context.setProxy({ server: proxy });
                }

                return context;
            });

            // Create new page
            this.page = await this.context.newPage();
        } catch (error) {
            console.error('Failed to initialize scraper:', error);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.page) await this.page.close();
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();
    }

    /**
     * Enforce rate limiting between requests
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const [minDelay, maxDelay] = CONFIG.delayRange.split(',').map(n => parseInt(n) * 1000);
        const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;
        
        if (timeSinceLastRequest < randomDelay) {
            await new Promise(resolve => setTimeout(resolve, randomDelay - timeSinceLastRequest));
        }
        
        this.lastRequestTime = Date.now();
    }

    /**
     * Check if article is premium content
     */
    async isPremiumArticle() {
        return await this.page.evaluate(() => {
            return document.body.textContent.includes('Member-only story') ||
                   document.querySelector('[aria-label="Post Preview"]') !== null;
        });
    }

    /**
     * Navigate to URL with retry and error handling
     */
    async navigateTo(url) {
        if (!url) {
            throw new Error('Invalid URL: URL cannot be empty');
        }

        return await retry(async () => {
            await this.enforceRateLimit();
            await this.page.goto(url, { 
                waitUntil: 'networkidle',
                timeout: CONFIG.navigation?.timeout || 30000
            });
        });
    }

    /**
     * Scrape author profile and posts with enhanced error handling
     */
    async scrapeAuthor(authorUrl) {
        try {
            if (!authorUrl) {
                throw new Error('Author URL is required');
            }

            await this.navigateTo(authorUrl);

            // Get author details using Author model
            const author = await Author.fromPage(this.page);

            // Navigate to author's stories page
            const storiesUrl = `${authorUrl}/latest`;
            await this.navigateTo(storiesUrl);

            // Scrape posts with enhanced error handling
            const posts = [];
            let hasMore = true;
            let scrollAttempts = 0;
            let lastHeight = 0;

            while (hasMore && posts.length < this.maxPosts && scrollAttempts < 10) {
                const newPosts = await retry(async () => {
                    return await this.page.evaluate(() => {
                        return Array.from(document.querySelectorAll('article')).map(article => {
                            const titleElement = article.querySelector('h2');
                            const linkElement = article.querySelector('a[aria-label]');
                            const dateElement = article.querySelector('time');
                            const clapsElement = article.querySelector('[data-testid="claps"]');
                            const tagsElements = article.querySelectorAll('[data-testid="tag"]');

                            return {
                                title: titleElement?.textContent.trim() || '',
                                url: linkElement?.href || '',
                                publishedDate: dateElement?.dateTime || '',
                                claps: parseInt(clapsElement?.textContent.replace(/[^0-9]/g, '')) || 0,
                                tags: Array.from(tagsElements).map(tag => tag.textContent.trim()),
                                readingTime: article.querySelector('[data-testid="readingTime"]')?.textContent.trim() || ''
                            };
                        });
                    });
                });

                // Add new unique posts using Post model
                for (const postData of newPosts) {
                    if (!posts.some(p => p.url === postData.url)) {
                        const post = new Post(postData);
                        if (post.url) {
                            posts.push(post);
                            if (posts.length >= this.maxPosts) {
                                hasMore = false;
                                break;
                            }
                        }
                    }
                }

                if (hasMore) {
                    // Scroll to load more with retry
                    await retry(async () => {
                        await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                        await this.page.waitForTimeout(2000);
                    });
                    
                    // Check if we've reached the end
                    const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
                    if (newHeight === lastHeight) {
                        scrollAttempts++;
                    } else {
                        lastHeight = newHeight;
                        scrollAttempts = 0;
                    }
                }
            }

            // Fetch article content if required
            if (this.includeArticleContent) {
                for (const post of posts) {
                    if (!post.url) continue;
                    
                    try {
                        await this.navigateTo(post.url);
                        
                        const isPremium = await this.isPremiumArticle();
                        if (isPremium && CONFIG.premiumHandling === 'exclude') {
                            post.content = null;
                            post.isPremium = true;
                            continue;
                        }

                        const content = await retry(async () => {
                            return await this.page.evaluate(() => {
                                const articleContent = document.querySelector('article');
                                return articleContent ? articleContent.textContent.trim() : '';
                            });
                        });
                        
                        Object.assign(post, { content, isPremium });
                    } catch (error) {
                        console.error(`Failed to scrape content for ${post.url}:`, error);
                        post.content = null;
                        post.error = error.message;
                    }
                }
            }

            return { author, posts };

        } catch (error) {
            console.error('Error scraping author:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
} 