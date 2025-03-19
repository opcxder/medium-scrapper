const Apify = require('apify');
const { log } = Apify.utils;
const fs = require('fs').promises;
const path = require('path');
const json2csv = require('json2csv').Parser;
const ExcelJS = require('exceljs');
const { parse } = require('json2csv');
const XLSX = require('xlsx');

/**
 * Utility functions for the Medium scraper
 */
class Utils {
    /**
     * Saves data to different formats (JSON, CSV, XLSX)
     * @param {Array} data - Data to save
     * @param {string} outputDir - Output directory
     * @param {Array} formats - Array of formats to save ('json', 'csv', 'xlsx')
     * @param {string} fileName - Base file name without extension
     * @returns {Promise<Object>} - Object with paths to saved files
     */
    static async saveDataToFiles(data, outputDir = './output', formats = ['json', 'csv', 'xlsx'], fileName = 'medium-scraper-output') {
        log.info(`Saving data to ${formats.join(', ')} format(s)...`);
        
        try {
            // Create output directory if it doesn't exist
            await fs.mkdir(outputDir, { recursive: true });
            
            const savedFiles = {};
            
            // Save in requested formats
            for (const format of formats) {
                const outputPath = path.join(outputDir, `${fileName}.${format}`);
                
                switch (format.toLowerCase()) {
                    case 'json':
                        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
                        savedFiles.json = outputPath;
                        break;
                        
                    case 'csv':
                        // Handle nested data for CSV
                        const flattenedData = data.map(item => {
                            // Create a shallow copy of the item
                            const flatItem = { ...item };
                            
                            // Handle arrays and objects
                            if (Array.isArray(flatItem.tags)) {
                                flatItem.tags = flatItem.tags.join(', ');
                            }
                            
                            if (Array.isArray(flatItem.comments)) {
                                flatItem.comments_count = flatItem.comments.length;
                                delete flatItem.comments; // Remove nested comments
                            }
                            
                            return flatItem;
                        });
                        
                        // Create CSV
                        if (flattenedData.length > 0) {
                            const csv = parse(flattenedData);
                            await fs.writeFile(outputPath, csv, 'utf8');
                            savedFiles.csv = outputPath;
                        }
                        break;
                        
                    case 'xlsx':
                        const wb = ExcelJS.utils.book_new();
                        const ws = ExcelJS.utils.json_to_sheet(data);
                        ExcelJS.utils.book_append_sheet(wb, ws, 'Articles');
                        await wb.xlsx.writeFile(outputPath);
                        savedFiles.xlsx = outputPath;
                        break;
                        
                    default:
                        throw new Error(`Unsupported format: ${format}`);
                }
            }
            
            return savedFiles;
        } catch (error) {
            console.error('Error saving data to files:', error);
            return null;
        }
    }
}

// Delay function for rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay between min and max
const randomDelay = (min, max) => {
    return delay(Math.floor(Math.random() * (max - min + 1) + min));
};

// Extract domain from URL
const extractDomain = (url) => {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
};

// Clean text content
const cleanText = (text) => {
    if (!text) return '';
    return text
        .replace(/\s+/g, ' ')
        .replace(/[\r\n]+/g, '\n')
        .trim();
};

// Calculate read time
const calculateReadTime = (wordCount) => {
    const wordsPerMinute = 200;
    return Math.ceil(wordCount / wordsPerMinute);
};

// Export data in different formats
const exportData = async (data, format, outputPath) => {
    try {
        switch (format.toLowerCase()) {
            case 'json':
                await fs.promises.writeFile(
                    `${outputPath}/output.json`,
                    JSON.stringify(data, null, 2)
                );
                break;
            case 'csv':
                const csv = parse(data);
                await fs.promises.writeFile(`${outputPath}/output.csv`, csv);
                break;
            case 'xlsx':
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, 'Articles');
                XLSX.writeFile(wb, `${outputPath}/output.xlsx`);
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
        return true;
    } catch (error) {
        console.error('Error exporting data:', error);
        return false;
    }
};

// Format article data
const formatArticleData = (article) => {
    return {
        title: cleanText(article.title),
        author: article.author,
        publication: article.publication || null,
        url: article.url,
        content: article.content ? cleanText(article.content) : null,
        word_count: article.content ? article.content.split(/\s+/).length : 0,
        read_time: `${calculateReadTime(article.word_count)} min`,
        is_premium: article.isPremium,
        tags: article.tags || [],
        comments: article.comments || [],
        scraped_at: new Date().toISOString()
    };
};

// Validate URL
const isValidUrl = (url) => {
    try {
        new URL(url);
        return url.includes('medium.com');
    } catch (e) {
        return false;
    }
};

module.exports = {
    delay,
    randomDelay,
    extractDomain,
    cleanText,
    calculateReadTime,
    exportData,
    formatArticleData,
    isValidUrl
};