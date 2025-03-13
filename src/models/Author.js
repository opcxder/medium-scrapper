/**
 * @typedef {Object} AuthorStats
 * @property {number} followers - Number of followers
 * @property {number} following - Number of users being followed
 * @property {number} totalPosts - Total number of posts
 */

/**
 * @typedef {Object} SocialLinks
 * @property {string} [twitter] - Twitter profile URL
 * @property {string} [linkedin] - LinkedIn profile URL
 * @property {string} [github] - GitHub profile URL
 * @property {string} [website] - Personal website URL
 */

export class Author {
    /**
     * @param {Object} data - Raw author data
     * @param {string} data.name - Author's full name
     * @param {string} data.username - Author's Medium username
     * @param {string} data.bio - Author's biography
     * @param {AuthorStats} data.stats - Author's statistics
     * @param {SocialLinks} [data.socialLinks] - Author's social media links
     * @param {string} data.imageUrl - Author's profile image URL
     */
    constructor(data) {
        this.name = data.name;
        this.username = data.username;
        this.bio = data.bio;
        this.stats = {
            followers: parseInt(data.followers) || 0,
            following: parseInt(data.following) || 0
        };
        this.scrapedAt = new Date().toISOString();
    }

    /**
     * Convert author data to JSON
     * @returns {Object} JSON representation of the author
     */
    toJSON() {
        return {
            name: this.name,
            username: this.username,
            bio: this.bio,
            stats: this.stats,
            scrapedAt: this.scrapedAt
        };
    }

    /**
     * Convert author data to CSV row
     * @returns {Object} Flattened object suitable for CSV conversion
     */
    toCSV() {
        return {
            name: this.name,
            username: this.username,
            bio: this.bio.replace(/\n/g, ' '),
            followers: this.stats.followers,
            following: this.stats.following,
            scrapedAt: this.scrapedAt
        };
    }

    /**
     * Create an Author instance from HTML elements
     * @param {import('playwright').Page} page - Playwright page object
     * @returns {Promise<Author>} New Author instance
     */
    static async fromPage(page) {
        const data = await page.evaluate(() => {
            const name = document.querySelector('h1')?.textContent.trim() || '';
            const bio = document.querySelector('[data-testid="authorBio"]')?.textContent.trim() || '';
            const followersText = document.querySelector('[data-testid="followersCount"]')?.textContent.trim() || '0';
            const followingText = document.querySelector('[data-testid="followingCount"]')?.textContent.trim() || '0';

            return {
                name,
                username: window.location.pathname.split('@')[1],
                bio,
                followers: parseInt(followersText.replace(/[^0-9]/g, '')) || 0,
                following: parseInt(followingText.replace(/[^0-9]/g, '')) || 0
            };
        });

        return new Author(data);
    }
} 