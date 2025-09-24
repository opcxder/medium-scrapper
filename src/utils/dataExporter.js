import fs from 'fs-extra';
import path from 'path';
import { createLogger } from './logger.js';
import { sanitizeFilename } from './contentProcessor.js';

const logger = createLogger({ util: 'DataExporter' });

/**
 * Export data in specified format
 * @param {Object} data - Data to export
 * @param {string} format - Export format (json, csv, xlsx)
 * @param {string} outputDir - Output directory
 * @returns {Object} - Export result
 */
export async function exportData(data, format = 'json', outputDir = './output') {
  try {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const authorName = data.author?.name || 'unknown-author';
    const sanitizedAuthor = sanitizeFilename(authorName);
    
    let filename;
    let content;
    
    switch (format.toLowerCase()) {
      case 'csv':
        filename = `${sanitizedAuthor}-${timestamp}.csv`;
        content = await exportToCSV(data);
        break;
        
      case 'xlsx':
        filename = `${sanitizedAuthor}-${timestamp}.xlsx`;
        content = await exportToXLSX(data);
        break;
        
      case 'json':
      default:
        filename = `${sanitizedAuthor}-${timestamp}.json`;
        content = await exportToJSON(data);
        break;
    }
    
    const filepath = path.join(outputDir, filename);
    
    if (format.toLowerCase() === 'xlsx') {
      // For XLSX, content is a buffer
      await fs.writeFile(filepath, content);
    } else {
      // For JSON and CSV, content is a string
      await fs.writeFile(filepath, content, 'utf8');
    }
    
    logger.info(`Data exported successfully to ${filename}`);
    
    return {
      success: true,
      filename,
      filepath,
      size: content.length || content.byteLength,
      format: format.toLowerCase()
    };
    
  } catch (error) {
    logger.error('Failed to export data', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Export data to JSON format
 * @param {Object} data - Data to export
 * @returns {string} - JSON content
 */
async function exportToJSON(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    logger.error('Failed to convert data to JSON', error);
    throw error;
  }
}

/**
 * Export data to CSV format
 * @param {Object} data - Data to export
 * @returns {string} - CSV content
 */
async function exportToCSV(data) {
  try {
    const { author, articles, stats, scrapedAt } = data;
    
    if (!articles || articles.length === 0) {
      return 'No articles found';
    }
    
    // Define CSV headers
    const headers = [
      'Article Title',
      'Article Subtitle',
      'Article URL',
      'Author Name',
      'Author URL',
      'Publication Date',
      'Reading Time (minutes)',
      'Claps',
      'Responses',
      'Tags',
      'Publication Name',
      'Publication URL',
      'Main Image URL',
      'Is Premium',
      'Series Name',
      'Series Part',
      'Word Count',
      'Keywords',
      'Hashtags',
      'Mentions',
      'Content Summary',
      'Comments Count',
      'Paywall Type',
      'Scraped At'
    ];
    
    // Convert articles to CSV rows
    const rows = articles.map(article => {
      const tags = Array.isArray(article.tags) ? article.tags.join('; ') : '';
      const keywords = Array.isArray(article.keywords) ? article.keywords.join('; ') : '';
      const hashtags = Array.isArray(article.hashtags) ? article.hashtags.join('; ') : '';
      const mentions = Array.isArray(article.mentions) ? article.mentions.join('; ') : '';
      const paywallType = article.paywallInfo?.type || 'none';
      const contentSummary = article.content?.textContent ? 
        article.content.textContent.substring(0, 200) + '...' : '';
      const commentsCount = article.comments ? article.comments.length : 0;
      
      return [
        `"${escapeCSV(article.title || '')}"`,
        `"${escapeCSV(article.subtitle || '')}"`,
        `"${escapeCSV(article.url || '')}"`,
        `"${escapeCSV(article.author || '')}"`,
        `"${escapeCSV(article.authorUrl || '')}"`,
        `"${escapeCSV(article.date || '')}"`,
        article.readTime || 0,
        article.claps || 0,
        article.responses || 0,
        `"${escapeCSV(tags)}"`,
        `"${escapeCSV(article.publication?.name || '')}"`,
        `"${escapeCSV(article.publication?.url || '')}"`,
        `"${escapeCSV(article.mainImage || '')}"`,
        article.isPremium ? 'Yes' : 'No',
        `"${escapeCSV(article.series?.name || '')}"`,
        `"${escapeCSV(article.series?.part || '')}"`,
        article.content?.wordCount || 0,
        `"${escapeCSV(keywords)}"`,
        `"${escapeCSV(hashtags)}"`,
        `"${escapeCSV(mentions)}"`,
        `"${escapeCSV(contentSummary)}"`,
        commentsCount,
        paywallType,
        `"${escapeCSV(scrapedAt || '')}"`
      ].join(',');
    });
    
    // Add statistics row
    const statsRow = [
      'STATISTICS',
      '',
      '',
      `"${escapeCSV(author?.name || 'Unknown')}"`,
      `"${escapeCSV(author?.url || '')}"`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      stats?.totalArticles || 0,
      '',
      '',
      '',
      `"Total Articles: ${stats?.totalArticles || 0}, Success Rate: ${stats?.successRate || 0}%, Paywall Rate: ${stats?.paywallRate || 0}%"`,
      stats?.errors || 0,
      `"Session Duration: ${stats?.sessionDuration || 0}ms"`,
      `"${escapeCSV(scrapedAt || '')}"`
    ].join(',');
    
    // Combine headers and rows
    return [
      headers.join(','),
      ...rows,
      statsRow
    ].join('\n');
    
  } catch (error) {
    logger.error('Failed to convert data to CSV', error);
    throw error;
  }
}

/**
 * Export data to XLSX format
 * @param {Object} data - Data to export
 * @returns {Buffer} - XLSX buffer
 */
async function exportToXLSX(data) {
  try {
    // For now, we'll create a simple XLSX-like format using a library
    // In a real implementation, you would use a proper XLSX library like 'xlsx'
    
    // For this implementation, we'll create an HTML table that can be opened in Excel
    const { author, articles, stats, scrapedAt } = data;
    
    if (!articles || articles.length === 0) {
      return Buffer.from('<html><body><p>No articles found</p></body></html>');
    }
    
    // Create HTML table
    let html = `
      <html>
      <head>
        <meta charset="utf-8">
        <title>Medium Articles - ${author?.name || 'Unknown Author'}</title>
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .stats { background-color: #e6f3ff; }
        </style>
      </head>
      <body>
        <h1>Medium Articles - ${author?.name || 'Unknown Author'}</h1>
        <p><strong>Scraped At:</strong> ${new Date(scrapedAt).toLocaleString()}</p>
        <p><strong>Total Articles:</strong> ${stats?.totalArticles || 0}</p>
        <p><strong>Success Rate:</strong> ${stats?.successRate || 0}%</p>
        <p><strong>Paywall Rate:</strong> ${stats?.paywallRate || 0}%</p>
        
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Date</th>
              <th>Reading Time</th>
              <th>Claps</th>
              <th>Responses</th>
              <th>Tags</th>
              <th>Publication</th>
              <th>Premium</th>
              <th>Word Count</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Add article rows
    articles.forEach(article => {
      const tags = Array.isArray(article.tags) ? article.tags.join(', ') : '';
      const isPremium = article.isPremium ? 'Yes' : 'No';
      
      html += `
        <tr>
          <td>${escapeHTML(article.title || '')}</td>
          <td>${escapeHTML(article.author || '')}</td>
          <td>${escapeHTML(article.date || '')}</td>
          <td>${article.readTime || 0}</td>
          <td>${article.claps || 0}</td>
          <td>${article.responses || 0}</td>
          <td>${escapeHTML(tags)}</td>
          <td>${escapeHTML(article.publication?.name || '')}</td>
          <td>${isPremium}</td>
          <td>${article.content?.wordCount || 0}</td>
          <td>${escapeHTML(article.url || '')}</td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    return Buffer.from(html, 'utf8');
    
  } catch (error) {
    logger.error('Failed to convert data to XLSX', error);
    throw error;
  }
}

/**
 * Escape CSV special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeCSV(text) {
  if (!text) return '';
  
  // Replace quotes with double quotes
  return text.replace(/"/g, '""');
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHTML(text) {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get export statistics
 * @param {string} format - Export format
 * @param {Object} data - Data that was exported
 * @returns {Object} - Export statistics
 */
export function getExportStats(format, data) {
  const articles = data.articles || [];
  const author = data.author || {};
  
  return {
    format: format.toLowerCase(),
    totalArticles: articles.length,
    authorName: author.name || 'Unknown',
    hasAuthorData: !!author.name,
    hasContentData: articles.some(a => a.content),
    hasCommentsData: articles.some(a => a.comments && a.comments.length > 0),
    premiumArticles: articles.filter(a => a.isPremium).length,
    totalClaps: articles.reduce((sum, a) => sum + (a.claps || 0), 0),
    totalResponses: articles.reduce((sum, a) => sum + (a.responses || 0), 0),
    averageReadTime: articles.length > 0 ? 
      Math.round(articles.reduce((sum, a) => sum + (a.readTime || 0), 0) / articles.length) : 0,
    scrapedAt: data.scrapedAt
  };
}