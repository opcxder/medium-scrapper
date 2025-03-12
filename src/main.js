import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser } from 'json2csv';
import xlsx from 'xlsx';
import CONFIG, { updateConfig, validateConfig } from './config/config.js';
import { MediumScraper } from './scrapers/MediumScraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Save data to file in the specified format
 * @param {Object} data - Data to save
 * @param {string} filename - Base filename without extension
 */
async function saveOutput(data, filename) {
    const outputDir = path.join(__dirname, '..', CONFIG.outputDir);
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `${filename}_${timestamp}`;

    switch (CONFIG.outputFormat) {
        case 'json':
            await fs.writeFile(
                path.join(outputDir, `${baseFilename}.json`),
                JSON.stringify(data, null, 2)
            );
            break;

        case 'csv':
            const parser = new Parser();
            const csv = parser.parse(data);
            await fs.writeFile(
                path.join(outputDir, `${baseFilename}.csv`),
                csv
            );
            break;

        case 'xlsx':
            const wb = xlsx.utils.book_new();
            const ws = xlsx.utils.json_to_sheet(data);
            xlsx.utils.book_append_sheet(wb, ws, 'Data');
            xlsx.writeFile(wb, path.join(outputDir, `${baseFilename}.xlsx`));
            break;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        // Read input configuration
        const inputPath = process.env.INPUT_PATH || path.join(__dirname, '..', 'input.json');
        const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));

        // Update configuration with user settings
        updateConfig(input);
        validateConfig();

        // Initialize scraper
        const scraper = new MediumScraper({
            maxPosts: input.maxPosts,
            includeArticleContent: input.includeArticleContent
        });

        console.log('Initializing scraper...');
        await scraper.init();

        // Scrape author data and posts
        console.log(`Scraping author: ${input.authorUrl}`);
        const { author, posts } = await scraper.scrapeAuthor(input.authorUrl);

        // Save author data
        await saveOutput(author.toJSON(), 'author');

        // Save posts data
        const postsData = posts.map(post => {
            switch (CONFIG.outputFormat) {
                case 'csv':
                case 'xlsx':
                    return post.toCSV();
                default:
                    return post.toJSON();
            }
        });
        await saveOutput(postsData, 'posts');

        console.log('Scraping completed successfully!');
        console.log(`Found ${posts.length} posts`);
        console.log(`Output saved in ${CONFIG.outputFormat} format`);

    } catch (error) {
        console.error('Scraping failed:', error);
        process.exit(1);
    }
}

// Run the scraper
main(); 