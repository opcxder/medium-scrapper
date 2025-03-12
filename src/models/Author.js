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
            followers: parseInt(data.stats.followers) || 0,
            following: parseInt(data.stats.following) || 0,
            totalPosts: parseInt(data.stats.totalPosts) || 0
        };
        this.socialLinks = data.socialLinks || {};
        this.imageUrl = data.imageUrl;
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
            socialLinks: this.socialLinks,
            imageUrl: this.imageUrl,
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
            totalPosts: this.stats.totalPosts,
            twitter: this.socialLinks.twitter || '',
            linkedin: this.socialLinks.linkedin || '',
            github: this.socialLinks.github || '',
            website: this.socialLinks.website || '',
            imageUrl: this.imageUrl,
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
            const getTextContent = selector => {
                const element = document.querySelector(selector);
                return element ? element.textContent.trim() : '';
            };

            const getFollowerCount = () => {
                const element = document.querySelector('[data-test-id="follower-count"]');
                if (!element) return 0;
                const text = element.textContent.trim();
                const number = text.match(/\d+/)?.[0] || '0';
                return parseInt(number);
            };

            const getSocialLinks = () => {
                const links = {};
                document.querySelectorAll('a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="github.com"]')
                    .forEach(link => {
                        const href = link.href;
                        if (href.includes('twitter.com')) links.twitter = href;
                        if (href.includes('linkedin.com')) links.linkedin = href;
                        if (href.includes('github.com')) links.github = href;
                    });
                return links;
            };

            return {
                name: getTextContent('[data-test-id="user-name"]'),
                username: window.location.pathname.split('@')[1],
                bio: getTextContent('[data-test-id="user-bio"]'),
                stats: {
                    followers: getFollowerCount(),
                    following: parseInt(getTextContent('[data-test-id="following-count"]') || '0'),
                    totalPosts: document.querySelectorAll('article').length
                },
                socialLinks: getSocialLinks(),
                imageUrl: document.querySelector('[data-test-id="user-avatar"]')?.src || ''
            };
        });

        return new Author(data);
    }
} 