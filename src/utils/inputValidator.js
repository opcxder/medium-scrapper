import { MEDIUM_CONSTANTS, ERROR_MESSAGES } from '../config/constants.js';

/**
 * Validates input parameters for the Medium scraper
 * @param {Object} input - Input object to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateInput(input) {
  const errors = [];
  
  if (!input) {
    errors.push('Input is required');
    return { isValid: false, errors };
  }
  
  // Validate authorUrl
  if (!input.authorUrl || typeof input.authorUrl !== 'string') {
    errors.push('Author URL is required and must be a string');
  } else {
    try {
      const url = new URL(input.authorUrl);
      if (!url.hostname.includes('medium.com')) {
        errors.push('URL must be a valid Medium URL (contain medium.com)');
      }
    } catch (error) {
      errors.push('Author URL must be a valid URL format');
    }
  }
  
  // Validate maxPosts
  if (input.maxPosts !== undefined) {
    if (typeof input.maxPosts !== 'number' || input.maxPosts < 1 || input.maxPosts > 1000) {
      errors.push('maxPosts must be a number between 1 and 1000');
    }
  }
  
  // Validate requestsPerSecond
  if (input.requestsPerSecond !== undefined) {
    if (typeof input.requestsPerSecond !== 'number' || 
        input.requestsPerSecond < 0.1 || input.requestsPerSecond > 5) {
      errors.push('requestsPerSecond must be a number between 0.1 and 5');
    }
  }
  
  // Validate outputFormat
  if (input.outputFormat !== undefined) {
    const validFormats = ['json', 'csv', 'xlsx'];
    if (!validFormats.includes(input.outputFormat)) {
      errors.push(`outputFormat must be one of: ${validFormats.join(', ')}`);
    }
  }
  
  // Validate sortBy
  if (input.sortBy !== undefined) {
    const validSortOptions = ['latest', 'popular', 'oldest'];
    if (!validSortOptions.includes(input.sortBy)) {
      errors.push(`sortBy must be one of: ${validSortOptions.join(', ')}`);
    }
  }
  
  // Validate dateRange
  if (input.dateRange !== undefined) {
    if (typeof input.dateRange !== 'object' || input.dateRange === null) {
      errors.push('dateRange must be an object');
    } else {
      if (input.dateRange.start && !isValidDate(input.dateRange.start)) {
        errors.push('dateRange.start must be a valid date string');
      }
      if (input.dateRange.end && !isValidDate(input.dateRange.end)) {
        errors.push('dateRange.end must be a valid date string');
      }
      if (input.dateRange.start && input.dateRange.end && 
          new Date(input.dateRange.start) > new Date(input.dateRange.end)) {
        errors.push('dateRange.start must be before dateRange.end');
      }
    }
  }
  
  // Validate tags
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      errors.push('tags must be an array');
    } else if (input.tags.length > 0) {
      const invalidTags = input.tags.filter(tag => typeof tag !== 'string' || tag.trim() === '');
      if (invalidTags.length > 0) {
        errors.push('All tags must be non-empty strings');
      }
    }
  }
  
  // Validate boolean fields
  const booleanFields = ['includeContent', 'includeComments', 'includePublication', 'useProxy', 'premiumContent'];
  for (const field of booleanFields) {
    if (input[field] !== undefined && typeof input[field] !== 'boolean') {
      errors.push(`${field} must be a boolean value`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates if a string is a valid date
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid date
 */
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Sanitizes input by removing potentially harmful characters and normalizing values
 * @param {Object} input - Input object to sanitize
 * @returns {Object} Sanitized input object
 */
export function sanitizeInput(input) {
  const sanitized = { ...input };
  
  // Sanitize authorUrl
  if (sanitized.authorUrl) {
    sanitized.authorUrl = sanitized.authorUrl.trim();
  }
  
  // Sanitize tags
  if (sanitized.tags && Array.isArray(sanitized.tags)) {
    sanitized.tags = sanitized.tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
  }
  
  // Set defaults
  sanitized.maxPosts = sanitized.maxPosts || MEDIUM_CONSTANTS.DEFAULT_MAX_POSTS;
  sanitized.requestsPerSecond = sanitized.requestsPerSecond || MEDIUM_CONSTANTS.DEFAULT_REQUESTS_PER_SECOND;
  sanitized.outputFormat = sanitized.outputFormat || 'json';
  sanitized.sortBy = sanitized.sortBy || 'latest';
  
  return sanitized;
}