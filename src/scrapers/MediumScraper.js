import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { createLogger } from '../utils/logger.js';
import { ProxyManager } from '../utils/proxyManager.js';
import { StealthHelper } from '../utils/stealthHelper.js';
import { PaywallDetector } from '../utils/paywallHandler.js';
import { getRandomUserAgent, shouldRotateUserAgent } from '../utils/userAgentManager.js';
import { MEDIUM_CONSTANTS, SELECTORS, ERROR_MESSAGES } from '../config/constants.js';
import { AuthorScraper } from './AuthorScraper.js';
import { ArticleScraper } from './ArticleScraper.js';

export class MediumScraper {
  constructor(input = {}) {
    this.input = {
      authorUrl: input.authorUrl || '',
      maxPosts: input.maxPosts || MEDIUM_CONSTANTS.DEFAULT_MAX_POSTS,
      includeContent: input.includeContent !== false,
      includeComments: input.includeComments === true,
      includePublication: input.includePublication !== false,
      tags: input.tags || [],
      requestsPerSecond: input.requestsPerSecond || MEDIUM_CONSTANTS.DEFAULT_REQUESTS_PER_SECOND,
      useProxy: input.useProxy !== false,
      outputFormat: input.outputFormat || 'json',
      premiumContent: input.premiumContent === true,
      dateRange: input.dateRange || null,
      sortBy: input.sortBy || 'latest',
      ...input
    };

    this.logger = createLogger({ scraper: 'MediumScraper', authorUrl: this.input.authorUrl });
    this.proxyManager = new ProxyManager({ useRotatingProxies: this.input.useProxy });
    this.stealthHelper = new StealthHelper();
    this.paywallDetector = new PaywallDetector({ handlePaywallGracefully: true });
    
    this.stats = {
      totalArticles: 0,
      successfulExtractions: 0,
      paywallHits: 0,
      errors: 0,
      startTime: Date.now()
    };

    this.crawler = null;
    this.dataset = null;
  }

  async initialize() {
    try {
      this.logger.logScrapingStart(this.input.authorUrl, this.input);
      
      // Initialize proxy manager
      await this.proxyManager.initialize();
      
      // Create dataset for storing results
      this.dataset = await Dataset.open('medium-scraper-results');
      
      // Validate input
      this.validateInput();
      
      // Setup crawler
      await this.setupCrawler();
      
      this.logger.info('Medium scraper initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize scraper', error);
      throw error;
    }
  }

  validateInput() {
    if (!this.input.authorUrl || !this.isValidMediumUrl(this.input.authorUrl)) {
      throw new Error(ERROR_MESSAGES.INVALID_URL);
    }

    if (this.input.maxPosts <= 0 || this.input.maxPosts > 1000) {
      throw new Error('maxPosts must be between 1 and 1000');
    }

    if (this.input.requestsPerSecond <= 0 || this.input.requestsPerSecond > 5) {
      throw new Error('requestsPerSecond must be between 0.1 and 5');
    }
  }

  isValidMediumUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.includes('medium.com') || parsedUrl.hostname.includes('medium');
    } catch {
      return false;
    }
  }

  async setupCrawler() {
    const launchOptions = {
      headless: false, // Use headful for better stealth
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--start-maximized',
        `--user-agent=${getRandomUserAgent()}`
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      },
      ignoreHTTPSErrors: true
    };

    // Import playwright dynamically for ES modules
    const { chromium } = await import('playwright');
    
    // Store reference to this scraper instance for use in handlers
    const scraperInstance = this;
    
    // Bind the requestHandler to preserve correct 'this' context
    const boundRequestHandler = this.handleRequest.bind(this);
    
    this.crawler = new PlaywrightCrawler({
      launchContext: {
        launcher: chromium,
        launchOptions
      },
      
      // Increase timeouts and add retry logic
      requestHandlerTimeoutSecs: 300, // Increase from default 60s
      navigationTimeoutSecs: 120,     // Increase navigation timeout from 60s
      maxRequestRetries: 5,           // Add more retries
      
      async requestHandler({ request, page, enqueueLinks, log }) {
        try {
          // Set longer timeout for this specific request
          page.setDefaultTimeout(120000);
          
          await boundRequestHandler(request, page, enqueueLinks, log);
        } catch (error) {
          scraperInstance.logger.error(`Request handler error for ${request.url}`, error);
          throw error;
        }
      },

      failedRequestHandler: async ({ request, error }) => {
        try {
          // Use the stored scraper instance reference
          if (scraperInstance && scraperInstance.logger) {
            scraperInstance.logger.error(`Request failed: ${request.url}`, error);
            scraperInstance.logger.error(`Error details: ${error.message || error}`);
          } else {
            console.error(`Request failed: ${request.url}`, error);
            console.error(`Error details: ${error.message || error}`);
          }
          if (scraperInstance && scraperInstance.stats) {
            scraperInstance.stats.errors++;
          }
        } catch (handlerError) {
          console.error('Error in failedRequestHandler:', handlerError);
        }
      },

      maxRequestsPerMinute: this.input.requestsPerSecond * 60,
      maxConcurrency: 1, // Single concurrent request for stealth
      retryOnBlocked: true,
      
      preNavigationHooks: [
        async (crawlingContext, gotoOptions) => {
          const { page } = crawlingContext;
          
          // Apply stealth settings
          await this.stealthHelper.applyStealthToPage(page);
          
          // Rotate proxy if needed
          if (this.proxyManager.shouldRotateProxy(this.stats.totalArticles)) {
            const newProxy = this.proxyManager.getNextProxy();
            if (newProxy) {
              this.logger.logProxyChange(newProxy);
            }
          }
          
          // Rotate user agent if needed
          if (shouldRotateUserAgent(this.stats.totalArticles)) {
            const newUserAgent = getRandomUserAgent();
            await page.setUserAgent(newUserAgent);
          }
        }
      ]
    });
  }

  async handleRequest(request, page, enqueueLinks, log) {
    const url = request.url;
    
    this.logger.info(`Handling request: ${url}`);
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        // Check if page is still valid
        if (page.isClosed()) {
          this.logger.warning('Page is closed, creating new page');
          // Request a new page or handle gracefully
          return;
        }
        
        // Wait for page to load with extended timeout for Medium pages
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: MEDIUM_CONSTANTS.PAGE_TIMEOUT });
          // Additional wait for dynamic content
          await page.waitForTimeout(2000 + Math.random() * 1000);
          this.logger.info(`Page loaded successfully: ${url}`);
        } catch (loadError) {
          this.logger.warn(`Page load timeout for ${url}, continuing anyway`);
          // Continue even if page doesn't fully load
        }
        
        // Simulate human behavior
        await this.stealthHelper.simulateHumanBehavior(page, {
          readingTime: 2000 + Math.random() * 3000,
          scrollCount: 1 + Math.floor(Math.random() * 3),
          mouseMovement: true,
          randomPauses: true
        });

        // Determine page type and handle accordingly
        if (this.isAuthorPage(url)) {
          await this.handleAuthorPage(page, url);
        } else if (this.isArticlePage(url)) {
          await this.handleArticlePage(page, url);
        } else {
          log.warning(`Unknown page type: ${url}`);
        }
        
        // Mark proxy as successful
        const currentProxy = this.proxyManager.getCurrentProxy();
        if (currentProxy) {
          this.proxyManager.markProxySuccess(currentProxy);
        }
        
        // Success, exit retry loop
        break;
        
      } catch (error) {
        retryCount++;
        this.logger.warning(`Attempt ${retryCount} failed for ${url}: ${error.message}`);
        
        if (retryCount === maxRetries) {
          this.logger.error(`Max retries reached for ${url}, failing request`);
          this.stats.errors++;
          
          // Mark proxy as failed
          const currentProxy = this.proxyManager.getCurrentProxy();
          if (currentProxy) {
            this.proxyManager.markProxyFailed(currentProxy);
          }
          
          throw error;
        }
        
        // Wait before retry with exponential backoff
        const retryDelay = 2000 * retryCount + Math.random() * 1000;
        this.logger.info(`Waiting ${retryDelay}ms before retry ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  isAuthorPage(url) {
    return url.includes('/@') && !url.includes('/p/') && !url.match(/\/[a-f0-9]{12,}$/);
  }

  isArticlePage(url) {
    return url.includes('/p/') || url.match(/\/[a-f0-9]{12,}$/) || url.includes('/story/');
  }

  async handleAuthorPage(page, url) {
    try {
      const authorScraper = new AuthorScraper(page, this.input);
      const authorData = await authorScraper.scrapeAuthor();
      
      if (authorData) {
        this.logger.logAuthorScraped(authorData);
        
        // Store author data
        await this.dataset.pushData({
          type: 'author',
          data: authorData,
          scrapedAt: new Date().toISOString()
        });
        
        // Enqueue article URLs for scraping
        if (authorData.articles && authorData.articles.length > 0) {
          const articleUrls = authorData.articles.slice(0, this.input.maxPosts).map(article => article.url);
          
          for (const articleUrl of articleUrls) {
            await this.crawler.addRequests([{
              url: articleUrl,
              userData: { isArticle: true }
            }]);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to scrape author page: ${url}`, error);
      throw error;
    }
  }

  async handleArticlePage(page, url) {
    try {
      // Detect paywall before scraping
      const paywallInfo = await this.paywallDetector.detectPaywall(page);
      
      if (paywallInfo.hasPaywall) {
        this.stats.paywallHits++;
        this.logger.logPaywallDetected(url);
        
        // Handle paywall
        const paywallResult = await this.paywallDetector.handlePaywall(page, paywallInfo);
        
        if (!paywallResult.success && !this.input.premiumContent) {
          this.logger.warn(`Skipping premium content: ${url}`);
          return;
        }
      }
      
      const articleScraper = new ArticleScraper(page, this.input, paywallInfo);
      const articleData = await articleScraper.scrapeArticle();
      
      if (articleData) {
        this.stats.successfulExtractions++;
        this.logger.logArticleScraped(articleData);
        
        // Store article data
        await this.dataset.pushData({
          type: 'article',
          data: articleData,
          scrapedAt: new Date().toISOString(),
          paywallInfo
        });
      }
      
      this.stats.totalArticles++;
      
    } catch (error) {
      this.logger.error(`Failed to scrape article page: ${url}`, error);
      throw error;
    }
  }

  async scrape() {
    try {
      await this.initialize();
      
      this.logger.info('Starting Medium scraping process');
      
      // Add initial request
      await this.crawler.addRequests([{
        url: this.input.authorUrl,
        userData: { isAuthor: true }
      }]);
      
      // Run the crawler
      await this.crawler.run();
      
      // Get final results
      const results = await this.getResults();
      
      // Log completion
      this.logger.logScrapingComplete(results);
      
      return results;
      
    } catch (error) {
      this.logger.error('Scraping process failed', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async getResults() {
    try {
      const allData = await this.dataset.getData();
      
      const authorData = allData.items.find(item => item.type === 'author')?.data;
      const articles = allData.items
        .filter(item => item.type === 'article')
        .map(item => item.data);
      
      return {
        author: authorData,
        articles: articles,
        stats: {
          ...this.stats,
          sessionDuration: Date.now() - this.stats.startTime,
          paywallRate: this.stats.totalArticles > 0 ? (this.stats.paywallHits / this.stats.totalArticles * 100).toFixed(2) : 0,
          successRate: this.stats.totalArticles > 0 ? (this.stats.successfulExtractions / this.stats.totalArticles * 100).toFixed(2) : 0
        },
        proxyStats: this.proxyManager.getStats(),
        paywallStats: this.paywallDetector.getStats(),
        scrapedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get results', error);
      return {
        author: null,
        articles: [],
        stats: this.stats,
        error: error.message
      };
    }
  }

  async cleanup() {
    try {
      if (this.crawler) {
        await this.crawler.teardown();
      }
      
      if (this.dataset) {
        await this.dataset.drop();
      }
      
      this.logger.info('Cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', error);
    }
  }
}

export default MediumScraper;