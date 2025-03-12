# Medium Author Scraper

A scalable Medium author scraper that extracts all posts from a given Medium author while handling rate limits, bypassing restrictions, and optimizing performance.

## Input Schema

The scraper accepts input in JSON format with the following fields:

### Required Fields

- `authorUrl` (string): The Medium profile URL of the author whose posts need to be scraped.
  - Format: `https://medium.com/@username`

### Optional Fields

- `maxPosts` (integer, default: -1): Number of posts to scrape. Use -1 to scrape all posts.
- `includeArticleContent` (boolean, default: true): Whether to scrape full article content.
- `outputFormat` (string, default: "json"): Output format - "json", "csv", or "xlsx".
- `cacheEnabled` (boolean, default: true): Enable caching to avoid redundant requests.
- `rateLimit` (object):
  - `requestsPerMinute` (integer, default: 30): Maximum requests per minute.
  - `randomDelay` (array, default: [2, 5]): Random delay range in seconds.
- `proxy` (object):
  - `useProxy` (boolean, default: false): Whether to use proxy servers.
  - `proxyUrls` (array): List of proxy URLs to rotate through.
- `recaptchaBypass` (boolean, default: false): Use CAPTCHA solving service.
- `premiumHandling` (string, default: "exclude"):
  - "exclude": Skip premium articles
  - "include-summary": Only scrape article summary
  - "full-bypass": Attempt to bypass premium restrictions

## Usage

1. Create an `input.json` file with your configuration:
\`\`\`json
{
  "authorUrl": "https://medium.com/@medium",
  "maxPosts": 100,
  "includeArticleContent": true,
  "outputFormat": "json"
}
\`\`\`

2. Run with Docker:
\`\`\`bash
# Windows CMD
docker run -v %cd%/output:/app/output -v %cd%/input.json:/app/input.json medium-scraper

# Windows PowerShell
docker run -v ${PWD}/output:/app/output -v ${PWD}/input.json:/app/input.json medium-scraper
\`\`\`

3. Check the `output` directory for your scraped data.

## Output Format

The scraper generates structured data in your chosen format (JSON/CSV/XLSX):

\`\`\`json
{
  "author": {
    "name": "Medium Staff",
    "username": "@medium",
    "bio": "...",
    "followers": 12345,
    "following": 100
  },
  "posts": [
    {
      "title": "Article Title",
      "url": "https://medium.com/@medium/article-slug",
      "publishedDate": "2024-03-12",
      "claps": 1000,
      "tags": ["Tag1", "Tag2"],
      "readingTime": "5 min",
      "isPremium": false,
      "content": "Full article content..."
    }
  ]
}
\`\`\`

## Development

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Run locally:
\`\`\`bash
npm start
\`\`\`

3. Build Docker image:
\`\`\`bash
npm run docker:build
\`\`\` 