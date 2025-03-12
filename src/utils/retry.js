import CONFIG from '../config/config.js';

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.initialDelay - Initial delay in milliseconds
 * @param {number} options.maxDelay - Maximum delay in milliseconds
 * @returns {Promise<any>} - Result of the function
 */
export async function retry(fn, {
    maxRetries = CONFIG.retry?.maxRetries || 3,
    initialDelay = CONFIG.retry?.initialDelay || 1000,
    maxDelay = CONFIG.retry?.maxDelay || 10000
} = {}) {
    let lastError;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (attempt === maxRetries) break;

            // Calculate next delay with exponential backoff
            delay = Math.min(delay * 2, maxDelay);
            
            // Add some randomness to prevent thundering herd
            const jitter = delay * (0.5 + Math.random());
            
            console.log(`Retrying in ${Math.round(jitter / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, jitter));
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
} 