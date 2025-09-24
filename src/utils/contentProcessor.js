import { createLogger } from './logger.js';

const logger = createLogger({ util: 'ContentProcessor' });

/**
 * Clean text content by removing extra whitespace and formatting
 * @param {string} text - Raw text content
 * @returns {string} - Cleaned text
 */
export function cleanText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
    .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
    .replace(/\u200B/g, '') // Remove zero-width spaces
    .replace(/\u200C/g, '') // Remove zero-width non-joiners
    .replace(/\u200D/g, '') // Remove zero-width joiners
    .replace(/\uFEFF/g, '') // Remove zero-width no-break spaces
    .trim();
}

/**
 * Extract reading time from text (e.g., "5 min read")
 * @param {string} text - Text containing reading time
 * @returns {number} - Reading time in minutes
 */
export function extractReadingTime(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  const match = text.match(/(\d+)\s*(?:min|minute|hr|hour)/i);
  if (match) {
    const time = parseInt(match[1], 10);
    const unit = match[0].toLowerCase();
    
    if (unit.includes('hr') || unit.includes('hour')) {
      return time * 60; // Convert hours to minutes
    }
    return time; // Already in minutes
  }
  
  return 0;
}

/**
 * Format date string to ISO format
 * @param {string|Date} date - Date string or Date object
 * @returns {string} - ISO formatted date string
 */
export function formatDate(date) {
  try {
    if (!date) return null;
    
    let dateObj;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      // Handle relative dates like "2 days ago"
      const relativeMatch = date.match(/(\d+)\s+(\w+)\s+ago/);
      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();
        
        dateObj = new Date();
        
        switch (unit) {
          case 'second':
          case 'seconds':
            dateObj.setSeconds(dateObj.getSeconds() - amount);
            break;
          case 'minute':
          case 'minutes':
            dateObj.setMinutes(dateObj.getMinutes() - amount);
            break;
          case 'hour':
          case 'hours':
            dateObj.setHours(dateObj.getHours() - amount);
            break;
          case 'day':
          case 'days':
            dateObj.setDate(dateObj.getDate() - amount);
            break;
          case 'week':
          case 'weeks':
            dateObj.setDate(dateObj.getDate() - (amount * 7));
            break;
          case 'month':
          case 'months':
            dateObj.setMonth(dateObj.getMonth() - amount);
            break;
          case 'year':
          case 'years':
            dateObj.setFullYear(dateObj.getFullYear() - amount);
            break;
        }
      } else {
        // Try to parse as regular date
        dateObj = new Date(date);
      }
    } else {
      return null;
    }
    
    if (isNaN(dateObj.getTime())) {
      return null;
    }
    
    return dateObj.toISOString();
    
  } catch (error) {
    logger.warn(`Failed to format date: ${date}`, error);
    return null;
  }
}

/**
 * Calculate reading time based on word count
 * @param {string} text - Text content
 * @param {number} wordsPerMinute - Reading speed (default: 200)
 * @returns {number} - Reading time in minutes
 */
export function calculateReadTime(text, wordsPerMinute = 200) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Extract domain from URL
 * @param {string} url - URL string
 * @returns {string} - Domain name
 */
export function extractDomain(url) {
  try {
    if (!url || typeof url !== 'string') {
      return '';
    }
    
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
    
  } catch (error) {
    logger.warn(`Failed to extract domain from: ${url}`, error);
    return '';
  }
}

/**
 * Sanitize filename by removing invalid characters
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'untitled';
  }
  
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .substring(0, 255) // Limit length
    .toLowerCase();
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} - Truncated text
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract hashtags from text
 * @param {string} text - Text content
 * @returns {string[]} - Array of hashtags
 */
export function extractHashtags(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const hashtagRegex = /#\w+/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(tag => tag.toLowerCase()) : [];
}

/**
 * Extract mentions from text
 * @param {string} text - Text content
 * @returns {string[]} - Array of mentions
 */
export function extractMentions(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const mentionRegex = /@\w+/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map(mention => mention.toLowerCase()) : [];
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether URL is valid
 */
export function isValidUrl(url) {
  try {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    new URL(url);
    return true;
    
  } catch (error) {
    return false;
  }
}

/**
 * Convert content to plain text
 * @param {Object} content - Structured content object
 * @returns {string} - Plain text content
 */
export function contentToPlainText(content) {
  if (!content) {
    return '';
  }
  
  if (typeof content === 'string') {
    return content;
  }
  
  const parts = [];
  
  if (content.title) {
    parts.push(content.title);
    parts.push(''); // Empty line
  }
  
  if (content.subtitle) {
    parts.push(content.subtitle);
    parts.push(''); // Empty line
  }
  
  if (content.textContent) {
    parts.push(content.textContent);
  }
  
  if (content.paragraphs && content.paragraphs.length > 0) {
    parts.push(...content.paragraphs);
  }
  
  if (content.quotes && content.quotes.length > 0) {
    content.quotes.forEach(quote => {
      parts.push(`"${quote.text}"`);
      if (quote.author) {
        parts.push(`— ${quote.author}`);
      }
      parts.push(''); // Empty line
    });
  }
  
  if (content.lists && content.lists.length > 0) {
    content.lists.forEach(list => {
      list.items.forEach((item, index) => {
        const prefix = list.type === 'ol' ? `${index + 1}.` : '•';
        parts.push(`${prefix} ${item}`);
      });
      parts.push(''); // Empty line
    });
  }
  
  return parts.join('\n').trim();
}

/**
 * Create summary of content
 * @param {string} text - Text content
 * @param {number} maxSentences - Maximum number of sentences
 * @returns {string} - Content summary
 */
export function createSummary(text, maxSentences = 3) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length <= maxSentences) {
    return text.trim();
  }
  
  return sentences.slice(0, maxSentences).join(' ').trim();
}

/**
 * Extract keywords from text
 * @param {string} text - Text content
 * @param {number} maxKeywords - Maximum number of keywords
 * @returns {string[]} - Array of keywords
 */
export function extractKeywords(text, maxKeywords = 10) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Common words to exclude
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]);
  
  // Extract words
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Count word frequencies
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Sort by frequency and return top keywords
  return Object.entries(wordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word);
}