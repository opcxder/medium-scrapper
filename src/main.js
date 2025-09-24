import { Actor } from 'apify';
import { MediumScraper } from './scrapers/MediumScraper.js';
import { createLogger } from './utils/logger.js';
import { exportData } from './utils/dataExporter.js';
import { validateInput } from './utils/inputValidator.js';

// Initialize logger
const logger = createLogger({ actor: 'MediumScraperActor' });

// Main Actor function
Actor.main(async () => {
  try {
    logger.info('🚀 Medium Scraper Actor starting...');
    
    // Get input from Apify
    const input = await Actor.getInput();
    logger.info('📋 Received input:', input);
    
    // Validate input
    const validationResult = validateInput(input);
    if (!validationResult.isValid) {
      throw new Error(`Invalid input: ${validationResult.errors.join(', ')}`);
    }
    
    // Create scraper instance
    const scraper = new MediumScraper(input);
    
    // Set up graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await scraper.cleanup();
      process.exit(0);
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Start scraping
    logger.info('🔄 Starting scraping process...');
    const startTime = Date.now();
    
    const results = await scraper.scrape();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    logger.info(`✅ Scraping completed in ${duration}s`);
    logger.info(`📊 Results: ${results.articles.length} articles extracted`);
    
    // Export results in requested format
    if (results.articles.length > 0) {
      const exportResult = await exportData(results, input.outputFormat || 'json');
      
      if (exportResult.success) {
        logger.info(`💾 Data exported successfully to ${exportResult.filename}`);
        
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
            paywallRate: results.stats.paywallRate,
            errorsCount: results.stats.errors
          }
        });
      } else {
        logger.error('❌ Failed to export data:', exportResult.error);
      }
    } else {
      logger.warn('⚠️ No articles found to export');
      
      await Actor.pushData({
        type: 'no_results',
        message: 'No articles found for the specified author',
        authorUrl: input.authorUrl,
        scrapedAt: new Date().toISOString(),
        duration
      });
    }
    
    // Log final statistics
    logger.info('📈 Final statistics:', results.stats);
    
  } catch (error) {
    logger.error('💥 Fatal error in Actor:', error);
    
    // Push error to dataset
    await Actor.pushData({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
    
    throw error;
  }
});