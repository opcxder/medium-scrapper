import { Actor } from 'apify';
import { MediumScraper } from './scrapers/MediumScraper.js';
import { createLogger } from './utils/logger.js';
import { exportData } from './utils/dataExporter.js';

// Initialize logger
const logger = createLogger({ actor: 'MediumScraperActor' });

// Input schema validation
const inputSchema = {
  type: 'object',
  properties: {
    authorUrl: {
      type: 'string',
      title: 'Author URL',
      description: 'Medium author profile URL (e.g., https://medium.com/@username)',
      pattern: '^https?://.*',
      minLength: 10
    },
    maxPosts: {
      type: 'number',
      title: 'Maximum Posts',
      description: 'Maximum number of posts to scrape (1-1000)',
      default: 10,
      minimum: 1,
      maximum: 1000
    },
    includeContent: {
      type: 'boolean',
      title: 'Include Article Content',
      description: 'Extract full article content',
      default: true
    },
    includeComments: {
      type: 'boolean',
      title: 'Include Comments',
      description: 'Extract article comments',
      default: false
    },
    includePublication: {
      type: 'boolean',
      title: 'Include Publication Info',
      description: 'Extract publication information',
      default: true
    },
    tags: {
      type: 'array',
      title: 'Filter by Tags',
      description: 'Only scrape articles with these tags',
      items: {
        type: 'string'
      },
      default: []
    },
    requestsPerSecond: {
      type: 'number',
      title: 'Requests Per Second',
      description: 'Rate limiting (0.1-5 requests per second)',
      default: 2,
      minimum: 0.1,
      maximum: 5
    },
    useProxy: {
      type: 'boolean',
      title: 'Use Proxy',
      description: 'Use rotating proxies for scraping',
      default: true
    },
    outputFormat: {
      type: 'string',
      title: 'Output Format',
      description: 'Output format for results',
      enum: ['json', 'csv', 'xlsx'],
      default: 'json'
    },
    premiumContent: {
      type: 'boolean',
      title: 'Include Premium Content',
      description: 'Attempt to scrape premium/member-only content',
      default: false
    },
    dateRange: {
      type: 'object',
      title: 'Date Range Filter',
      description: 'Filter articles by date range',
      properties: {
        start: {
          type: 'string',
          format: 'date',
          title: 'Start Date'
        },
        end: {
          type: 'string',
          format: 'date',
          title: 'End Date'
        }
      }
    },
    sortBy: {
      type: 'string',
      title: 'Sort Articles By',
      description: 'How to sort extracted articles',
      enum: ['latest', 'popular', 'oldest'],
      default: 'latest'
    }
  },
  required: ['authorUrl']
};

// Main Actor function
Actor.main(async () => {
  try {
    logger.info('Medium Scraper Actor starting...');
    
    // Get input from Apify
    const input = await Actor.getInput();
    logger.info('Received input:', input);
    
    // Validate input
    if (!input || !input.authorUrl) {
      throw new Error('Author URL is required');
    }
    
    // Validate URL format
    try {
      new URL(input.authorUrl);
    } catch (error) {
      throw new Error(`Invalid URL format: ${input.authorUrl}`);
    }
    
    // Check if it's a Medium URL
    if (!input.authorUrl.includes('medium.com')) {
      logger.warn('URL does not contain medium.com, but proceeding anyway');
    }
    
    // Create scraper instance
    const scraper = new MediumScraper(input);
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await scraper.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await scraper.cleanup();
      process.exit(0);
    });
    
    // Start scraping
    logger.info('Starting scraping process...');
    const startTime = Date.now();
    
    const results = await scraper.scrape();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    logger.info(`Scraping completed in ${duration}s`);
    logger.info(`Results: ${results.articles.length} articles extracted`);
    
    // Export results in requested format
    if (results.articles.length > 0) {
      const exportResult = await exportData(results, input.outputFormat || 'json');
      
      if (exportResult.success) {
        logger.info(`Data exported successfully to ${exportResult.filename}`);
        
        // Push results to Apify dataset
        await Actor.pushData({
          type: 'final_results',
          data: results,
          exportInfo: exportResult,
          metadata: {
            scrapedAt: new Date().toISOString(),
            duration,
            articlesCount: results.articles.length,
            successRate: results.stats.successRate,
            paywallRate: results.stats.paywallRate
          }
        });
      } else {
        logger.error('Failed to export data:', exportResult.error);
      }
    } else {
      logger.warn('No articles found to export');
      
      await Actor.pushData({
        type: 'no_results',
        message: 'No articles found for the specified author',
        authorUrl: input.authorUrl,
        scrapedAt: new Date().toISOString(),
        duration
      });
    }
    
    // Log final statistics
    logger.info('Final statistics:', {
      articlesScraped: results.articles.length,
      totalArticles: results.stats.totalArticles,
      successfulExtractions: results.stats.successfulExtractions,
      paywallHits: results.stats.paywallHits,
      errors: results.stats.errors,
      successRate: results.stats.successRate,
      paywallRate: results.stats.paywallRate,
      duration: `${duration}s`,
      proxyChanges: results.proxyStats?.rotations || 0
    });
    
    logger.info('Medium Scraper Actor completed successfully');
    
  } catch (error) {
    logger.error('Actor failed with error:', error);
    
    // Push error to dataset
    await Actor.pushData({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
    
    // Re-throw to let Apify handle the error
    throw error;
  }
});