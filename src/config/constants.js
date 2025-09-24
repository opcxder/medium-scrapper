// Constants for Medium scraping
export const MEDIUM_CONSTANTS = {
  BASE_URL: 'https://medium.com',
  API_BASE: 'https://medium.com/_/api',
  GRAPHQL_ENDPOINT: 'https://medium.com/_/graphql',
  
  // Rate limiting
  DEFAULT_REQUESTS_PER_SECOND: 1,
  MAX_REQUESTS_PER_SECOND: 3,
  MIN_REQUEST_DELAY: 1000,
  MAX_REQUEST_DELAY: 3000,
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  RETRY_DELAY_MULTIPLIER: 2,
  
  // Pagination
  DEFAULT_MAX_POSTS: 50,
  INFINITE_SCROLL_DELAY: 2000,
  SCROLL_INCREMENT: 500,
  
  // Timeouts
  PAGE_TIMEOUT: 45000,
  NAVIGATION_TIMEOUT: 90000,
  ELEMENT_TIMEOUT: 15000,
  
  // Content processing
  MIN_READ_TIME: 30,
  MAX_READ_TIME: 1200,
  WORDS_PER_MINUTE: 200,
  
  // Stealth settings
  USER_AGENT_ROTATION_INTERVAL: 10,
  PROXY_ROTATION_INTERVAL: 5,
  SESSION_DURATION: 1800000, // 30 minutes
};

export const SELECTORS = {
  // Author page selectors
  AUTHOR: {
    NAME: 'h1[data-testid="authorName"], h1[data-testid="publicationName"], h1[aria-label*="profile"], .pw-author-name',
    BIO: 'p[data-testid="authorBio"], div[data-testid="publicationDescription"], .pw-bio',
    AVATAR: 'img[data-testid="authorImage"], img[data-testid="publicationImage"], img[alt*="profile"], .pw-author-image',
    FOLLOWERS: 'button[data-testid="followersCount"], a[data-testid="followersLink"], a[href*="/followers"], .pw-followers-count',
    FOLLOWING: 'button[data-testid="followingCount"], a[data-testid="followingLink"], a[href*="/following"], .pw-following-count',
    USERNAME: 'span[data-testid="username"], div[data-testid="authorUsername"], .pw-username',
    SOCIAL_LINKS: 'a[data-testid="socialLink"], div[data-testid="socialLinks"] a, a[rel="noopener"]',
    PUBLICATIONS: 'div[data-testid="publication"] a[data-testid="publicationLink"], a[href*="/publications"]',
    PUBLICATION_ROLE: 'span[data-testid="publicationRole"], .pw-publication-role',
    ARTICLES_CONTAINER: 'div[data-testid="articlesContainer"], div[data-testid="postsContainer"], main[role="main"], .pw-articles-container',
    ARTICLE_LINKS: 'article a[href*="/@"], div[data-testid="articleLink"] a, a[data-testid="postLink"]',
    ARTICLE_TITLE: 'h2[data-testid="articleTitle"], h3[data-testid="postTitle"], h1[data-testid="postTitle"], .pw-post-title',
    ARTICLE_SUBTITLE: 'p[data-testid="articleSubtitle"], p[data-testid="postSubtitle"], .pw-post-subtitle',
    ARTICLE_DATE: 'time[data-testid="articleDate"], span[data-testid="publishDate"], time[datetime], .pw-post-date',
    ARTICLE_READ_TIME: 'span[data-testid="readingTime"], span[data-testid="readTime"], .pw-reading-time',
    ARTICLE_CLAPS: 'button[data-testid="clapButton"], div[data-testid="clapCount"], button[aria-label*="clap"], .pw-clap-count',
    ARTICLE_RESPONSES: 'a[data-testid="responsesLink"], button[data-testid="responsesButton"], a[href*="/responses"], .pw-response-count',
    ARTICLE_TAGS: 'a[data-testid="tagLink"], div[data-testid="articleTags"] a, a[href*="/tag/"], .pw-post-tags a',
    ARTICLE_PUBLICATION: 'a[data-testid="publicationName"], div[data-testid="publicationTitle"], a[href*="/publication/"]',
    ARTICLE_IMAGE: 'img[data-testid="articleImage"], img[data-testid="postImage"], img[alt*="post"], .pw-post-image',
    PREMIUM_INDICATORS: 'span[data-testid="memberOnlyBadge"], div[data-testid="premiumBadge"], span[aria-label*="member"], .pw-premium-badge'
  },
  
  // Article selectors
  ARTICLE_LINK: 'article a[href*="/@"], div[data-testid="articleLink"] a',
  ARTICLE_TITLE: 'h1, h2[data-testid="articleTitle"]',
  ARTICLE_SUBTITLE: 'h2[data-testid="articleSubtitle"], p[data-testid="articleSubtitle"]',
  ARTICLE_CONTENT: 'article div[data-testid="articleContent"], div[data-testid="articleBody"]',
  ARTICLE_DATE: 'time[data-testid="articleDate"], span[data-testid="publishDate"]',
  ARTICLE_READING_TIME: 'span[data-testid="readingTime"], span[data-testid="readTime"]',
  ARTICLE_CLAPS: 'button[data-testid="clapButton"], div[data-testid="clapCount"]',
  ARTICLE_RESPONSES: 'a[data-testid="responsesLink"], button[data-testid="responsesButton"]',
  ARTICLE_TAGS: 'a[data-testid="tagLink"], div[data-testid="articleTags"] a',
  
  // Paywall and premium content
  PAYWALL_INDICATOR: 'div[data-testid="paywall"], div[data-testid="premiumContent"]',
  MEMBER_ONLY_BADGE: 'span[data-testid="memberOnlyBadge"], div[data-testid="premiumBadge"]',
  CONTINUE_READING: 'button[data-testid="continueReading"], a[data-testid="continueReading"]',
  SUBSCRIPTION_PROMPT: 'div[data-testid="subscriptionPrompt"], div[data-testid="paywallPrompt"]',
  
  // Comments and interactions
  COMMENTS_SECTION: 'div[data-testid="commentsSection"], section[data-testid="responses"]',
  COMMENT_COUNT: 'span[data-testid="commentCount"], div[data-testid="responseCount"]',
  
  // Navigation and UI
  INFINITE_SCROLL_CONTAINER: 'div[data-testid="infiniteScroll"], main[data-testid="mainContent"]',
  LOADING_INDICATOR: 'div[data-testid="loading"], div[data-testid="spinner"]',
  ERROR_MESSAGE: 'div[data-testid="errorMessage"], div[data-testid="error"]',
  
  // Publication info
  PUBLICATION_NAME: 'a[data-testid="publicationName"], div[data-testid="publicationTitle"]',
  PUBLICATION_LOGO: 'img[data-testid="publicationLogo"], div[data-testid="publicationImage"]',
};

export const GRAPHQL_QUERIES = {
  AUTHOR_POSTS: `
    query AuthorPosts($username: ID!, $limit: Int!, $offset: Int!) {
      user(username: $username) {
        posts(limit: $limit, offset: $offset) {
          id
          title
          slug
          createdAt
          updatedAt
          readingTime
          clapCount
          responseCount
          isPremium
          tags {
            name
            slug
          }
          publication {
            name
            slug
          }
        }
      }
    }
  `,
  
  ARTICLE_CONTENT: `
    query ArticleContent($postId: ID!) {
      post(id: $postId) {
        id
        title
        subtitle
        content
        htmlContent
        markdown
        author {
          name
          username
          bio
        }
        tags
        topics
        clapCount
        responseCount
        readingTime
        isPremium
        paywall
        createdAt
        updatedAt
      }
    }
  `,
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred',
  RATE_LIMITED: 'Rate limited by Medium',
  PAYWALL_DETECTED: 'Premium content detected',
  AUTHOR_NOT_FOUND: 'Author not found',
  ARTICLE_NOT_FOUND: 'Article not found',
  INVALID_URL: 'Invalid Medium URL',
  TIMEOUT_ERROR: 'Request timeout',
  BROWSER_ERROR: 'Browser automation error',
  PROXY_ERROR: 'Proxy connection failed',
  CAPTCHA_DETECTED: 'CAPTCHA challenge detected',
};

export const SUCCESS_MESSAGES = {
  SCRAPING_STARTED: 'Medium scraping started',
  AUTHOR_SCRAPED: 'Author information scraped successfully',
  ARTICLE_SCRAPED: 'Article scraped successfully',
  BATCH_COMPLETED: 'Batch processing completed',
  EXPORT_COMPLETED: 'Data export completed',
  PROXY_ROTATED: 'Proxy rotated successfully',
  STEALTH_ACTIVATED: 'Stealth mode activated',
};

export default {
  MEDIUM_CONSTANTS,
  SELECTORS,
  GRAPHQL_QUERIES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};