const { Actor } = require('apify');
const MediumScraper = require('./scraper');
const { exportData } = require('./utils');

Actor.main(async () => {
    // Get input
    const input = await Actor.getInput();
    
    // Validate required input
    if (!input?.authorUrl) {
        throw new Error('Author URL is required');
    }

    // Initialize scraper
    const scraper = new MediumScraper(input);
    
    try {
        // Initialize browser
        await scraper.initialize();
        
        console.log('Starting to scrape articles...');
        const startTime = Date.now();
        
        // Scrape articles
        const articles = await scraper.scrapeArticles();
        
        // Calculate statistics
        const stats = {
            total_articles_scraped: articles.length,
            total_comments_scraped: articles.reduce((sum, article) => sum + (article.comments?.length || 0), 0),
            time_taken: `${((Date.now() - startTime) / 1000).toFixed(1)} seconds`
        };

        // Export data in requested format
        const outputFormat = input.outputFormat || 'json';
        await exportData(articles, outputFormat, './output');

        // Store results in default dataset
        await Actor.pushData({
            articles,
            stats
        });

        console.log('Scraping completed successfully!');
        console.log('Statistics:', stats);

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    } finally {
        // Clean up
        await scraper.close();
    }
});