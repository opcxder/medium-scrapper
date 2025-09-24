import { Actor } from 'apify';
import { MediumScraper } from './src/scrapers/MediumScraper.js';
import { createLogger } from './src/utils/logger.js';

// Test script to run the scraper directly

const testInput = {
  authorUrl: 'https://medium.com/@medium',
  maxPosts: 3,
  includeContent: true,
  includeComments: false,
  includePublication: true,
  requestsPerSecond: 1,
  useProxy: false, // Disable proxy for testing
  outputFormat: 'json',
  premiumContent: false,
  sortBy: 'latest'
};

let logger;

async function runTest() {
  try {
    // Initialize Actor for proper Crawlee dataset support
    await Actor.init();
    
    logger = createLogger({ test: 'MediumScraperTest' });
    logger.info('🧪 Starting Medium scraper test...');
    
    // Create storage directory
    const fs = await import('fs/promises');
    await fs.mkdir('./storage/datasets/default', { recursive: true });
    
    const scraper = new MediumScraper(testInput);
    await scraper.initialize();
    
    logger.info('🔄 Starting scraping process...');
    const results = await scraper.scrape();
    
    logger.info(`✅ Test completed! Extracted ${results.articles.length} articles`);
    logger.info('📊 Statistics:', results.stats);
    
    // Save results to file
    await fs.writeFile('test-results.json', JSON.stringify(results, null, 2));
    logger.info('💾 Results saved to test-results.json');
    
    // Cleanup Actor
    await Actor.exit();
    
  } catch (error) {
    logger.error('💥 Test failed:', error);
    console.error(error.stack);
    await Actor.exit();
  }
}

runTest();