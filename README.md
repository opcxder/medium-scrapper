# Medium Author Scraper - Apify Actor

A powerful and scalable Apify actor for scraping Medium author's blog posts, handling both premium and free content.

## 🚀 Features

- ✅ Scrape articles from any Medium author's profile
- ✅ Handle both premium and free content
- ✅ Extract full article content (optional)
- ✅ Collect article comments (optional)
- ✅ Filter articles by tags
- ✅ Extract publication information
- ✅ Smart rate limiting and proxy rotation
- ✅ Multiple output formats (JSON, CSV, XLSX)
- ✅ Stealth mode to bypass Medium's anti-scraping
- ✅ Efficient handling of infinite scroll
- ✅ Detailed scraping statistics

## 📋 Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| authorUrl | String | Yes | - | URL of the Medium author's profile |
| maxPosts | Number | No | 10 | Maximum number of posts to scrape (0 for all) |
| includeContent | Boolean | No | true | Whether to include full article content |
| includeComments | Boolean | No | false | Whether to include article comments |
| tags | Array | No | [] | Filter articles by specific tags |
| includePublication | Boolean | No | true | Whether to extract publication information |
| requestsPerSecond | Number | No | 2 | Rate limit for requests |
| useProxy | Boolean | No | true | Whether to use Apify Smart Proxy |
| outputFormat | String | No | "json" | Output format ("json", "csv", or "xlsx") |

## 📤 Output Format

The actor outputs data in the following structure:

```json
{
  "articles": [
    {
      "title": "Article Title",
      "author": "Author Name",
      "publication": "Publication Name",
      "url": "https://medium.com/article-url",
      "content": "Full article content...",
      "word_count": 1500,
      "read_time": "5 min",
      "is_premium": false,
      "tags": ["tag1", "tag2"],
      "comments": [
        {
          "user": "Commenter Name",
          "comment": "Comment text",
          "likes": 10
        }
      ],
      "scraped_at": "2024-03-19T12:00:00Z"
    }
  ],
  "stats": {
    "total_articles_scraped": 10,
    "total_comments_scraped": 25,
    "time_taken": "45.2 seconds"
  }
}
```

## 🛠️ Technical Details

- Built with Playwright and Apify SDK
- Uses headless Chromium browser
- Implements stealth techniques to avoid detection
- Smart handling of rate limits and proxies
- Efficient memory usage for large-scale scraping

## 🚦 Usage Limits

- Rate limiting is enforced to prevent overloading Medium's servers
- Proxy rotation is recommended for large-scale scraping
- Memory usage is optimized for handling large datasets

## 📝 Example Usage

```javascript
const input = {
    "authorUrl": "https://medium.com/@authorname",
    "maxPosts": 50,
    "includeContent": true,
    "includeComments": true,
    "tags": ["programming", "technology"],
    "outputFormat": "json"
};
```

## ⚠️ Important Notes

1. Respect Medium's terms of service and rate limits
2. Some content may be inaccessible without proper authentication
3. Premium content may be limited or unavailable
4. Use proxy rotation for better reliability
5. Large-scale scraping should be done responsibly

## 🔧 Maintenance

- Regular updates to handle Medium's platform changes
- Continuous monitoring of anti-scraping measures
- Performance optimizations as needed

## 📄 License

ISC License 