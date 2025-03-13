export class Post {
    /**
     * @param {Object} data - Raw post data
     * @param {string} data.title - Post title
     * @param {string} data.url - Post URL
     * @param {string} data.publishedDate - Publication date
     * @param {number} data.claps - Number of claps
     * @param {string[]} data.tags - Post tags
     * @param {string} data.readingTime - Reading time estimate
     * @param {string} [data.content] - Post content (optional)
     * @param {boolean} [data.isPremium] - Whether it's a premium article
     */
    constructor(data) {
        this.title = data.title || '';
        this.url = data.url || '';
        if (!this.url && data.title) {
            // Generate URL from title if missing
            const slug = data.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            this.url = `https://medium.com/p/${slug}`;
        }
        this.publishedDate = data.publishedDate || new Date().toISOString();
        this.claps = parseInt(data.claps) || 0;
        this.tags = Array.isArray(data.tags) ? data.tags : [];
        this.readingTime = data.readingTime || '';
        this.content = data.content || null;
        this.isPremium = data.isPremium || false;
        this.scrapedAt = new Date().toISOString();
    }

    /**
     * Convert post data to JSON
     * @returns {Object} JSON representation of the post
     */
    toJSON() {
        return {
            title: this.title,
            url: this.url,
            publishedDate: this.publishedDate,
            claps: this.claps,
            tags: this.tags,
            readingTime: this.readingTime,
            content: this.content,
            isPremium: this.isPremium,
            scrapedAt: this.scrapedAt
        };
    }

    /**
     * Convert post data to CSV row
     * @returns {Object} Flattened object suitable for CSV conversion
     */
    toCSV() {
        return {
            title: this.title,
            url: this.url,
            publishedDate: this.publishedDate,
            claps: this.claps,
            tags: this.tags.join(', '),
            readingTime: this.readingTime,
            content: this.content ? this.content.replace(/\n/g, ' ').substring(0, 1000) : '',
            isPremium: this.isPremium,
            scrapedAt: this.scrapedAt
        };
    }
} 