# Medium Author Scraper

A scalable Medium author scraper that extracts all posts from a given Medium author while handling rate limits and optimizing performance.

## Setup

1. Install Node.js 20 or later from [nodejs.org](https://nodejs.org/)

2. Clone this repository:
```bash
git clone https://github.com/opcxder/medium-scrapper.git
cd medium-scrapper
```

3. Install dependencies and setup Playwright:
```bash
npm run setup
```

## Usage

1. Create an `input.json` file with your configuration:
```json
{
  "authorUrl": "https://medium.com/@medium",
  "maxPosts": 100,
  "includeArticleContent": true,
  "outputFormat": "json",
  "requestsPerMinute": 30,
  "delayRange": "2,5"
}
```

2. Run the scraper:
```bash
npm start
```

3. Check the `output` directory for your scraped data.

## Input Schema

The scraper accepts input in JSON format with the following fields. The complete schema can be found in `INPUT_SCHEMA.json`.

### Required Fields

- `authorUrl` (string): The Medium profile URL of the author whose posts need to be scraped.
  - Format: `https://medium.com/@username`

### Optional Fields

- `maxPosts` (integer, default: -1): Number of posts to scrape. Use -1 to scrape all posts.
- `includeArticleContent` (boolean, default: true): Whether to scrape full article content.
- `outputFormat` (string, default: "json"): Output format - "json", "csv", or "xlsx".
- `cacheEnabled` (boolean, default: true): Enable caching to avoid redundant requests.
- `requestsPerMinute` (integer, default: 30): Maximum requests per minute.
- `delayRange` (string, default: "2,5"): Random delay range between requests in seconds (format: "min,max").
- `proxy` (object): Configure proxy settings to avoid IP blocks.
  - `useApifyProxy` (boolean, default: true): Whether to use Apify's proxy service.
- `premiumHandling` (string, default: "exclude"):
  - "exclude": Skip premium articles
  - "include-summary": Only scrape article summary

## Output Format

The scraper generates structured data in your chosen format (JSON/CSV/XLSX):

```json
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
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Run locally:
```bash
npm start
```

3. Clean output and cache:
```bash
npm run clean
``` 