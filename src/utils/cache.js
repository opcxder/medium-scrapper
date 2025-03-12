import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import CONFIG from '../config/config.js';

class Cache {
    constructor(cacheDir) {
        this.cacheDir = cacheDir;
    }

    /**
     * Initialize the cache directory
     */
    async init() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create cache directory:', error);
        }
    }

    /**
     * Generate a cache key from a URL
     * @param {string} url - The URL to generate a key for
     * @returns {string} The cache key
     */
    generateKey(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    /**
     * Get the full path for a cache key
     * @param {string} key - The cache key
     * @returns {string} The full file path
     */
    getPath(key) {
        return path.join(this.cacheDir, `${key}.json`);
    }

    /**
     * Get data from cache
     * @param {string} url - The URL to get cached data for
     * @returns {Promise<object|null>} The cached data or null if not found
     */
    async get(url) {
        if (!CONFIG.cacheEnabled) return null;

        try {
            const key = this.generateKey(url);
            const filePath = this.getPath(key);
            const data = await fs.readFile(filePath, 'utf8');
            const { content, timestamp } = JSON.parse(data);

            // Check if cache is older than 24 hours
            if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
                await this.delete(url);
                return null;
            }

            return content;
        } catch (error) {
            return null;
        }
    }

    /**
     * Save data to cache
     * @param {string} url - The URL to cache data for
     * @param {object} data - The data to cache
     */
    async set(url, data) {
        if (!CONFIG.cacheEnabled) return;

        try {
            const key = this.generateKey(url);
            const filePath = this.getPath(key);
            const cacheData = {
                content: data,
                timestamp: Date.now()
            };
            await fs.writeFile(filePath, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Failed to write to cache:', error);
        }
    }

    /**
     * Delete cached data
     * @param {string} url - The URL to delete cached data for
     */
    async delete(url) {
        try {
            const key = this.generateKey(url);
            const filePath = this.getPath(key);
            await fs.unlink(filePath);
        } catch (error) {
            // Ignore errors if file doesn't exist
        }
    }

    /**
     * Clear all cached data
     */
    async clear() {
        try {
            const files = await fs.readdir(this.cacheDir);
            await Promise.all(
                files.map(file => 
                    fs.unlink(path.join(this.cacheDir, file))
                )
            );
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }
}

// Create and initialize cache instance
const cache = new Cache(CONFIG.cacheDir);
await cache.init();

export default cache; 