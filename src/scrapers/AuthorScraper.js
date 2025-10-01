import { createLogger } from '../utils/logger.js';
import { MEDIUM_CONSTANTS, SELECTORS, GRAPHQL_QUERIES } from '../config/constants.js';
import { cleanText, extractReadingTime, formatDate, calculateReadTime } from '../utils/contentProcessor.js';

export class AuthorScraper {
  constructor(page, input = {}) {
    this.page = page;
    this.input = input;
    this.logger = createLogger({ scraper: 'AuthorScraper', url: page.url() });
  }

  async scrapeAuthor() {
    try {
      this.logger.info('Starting author scraping');
      
      // Wait for author page to load
      await this.waitForAuthorPage();
      
      // Extract basic author information
      const authorInfo = await this.extractAuthorInfo();
      
      if (!authorInfo) {
        throw new Error('Failed to extract author information');
      }
      
      // Extract author articles with infinite scroll
      const articles = await this.extractAuthorArticles();
      
      // Filter articles based on input criteria
      const filteredArticles = this.filterArticles(articles);
      
      return {
        ...authorInfo,
        articles: filteredArticles,
        totalArticles: articles.length,
        filteredCount: filteredArticles.length,
        scrapedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Author scraping failed', error);
      throw error;
    }
  }

  async waitForAuthorPage() {
    try {
      // Wait for author profile to load
      await this.page.waitForSelector(SELECTORS.AUTHOR.NAME, { 
        timeout: MEDIUM_CONSTANTS.PAGE_TIMEOUT,
        state: 'visible'
      });
      
      // Wait for articles section to appear
      await this.page.waitForSelector(SELECTORS.AUTHOR.ARTICLES_CONTAINER, { 
        timeout: MEDIUM_CONSTANTS.PAGE_TIMEOUT,
        state: 'visible'
      });
      
      // Additional wait for dynamic content
      await this.page.waitForTimeout(1000 + Math.random() * 1000);
      
    } catch (error) {
      this.logger.warn('Timeout waiting for author page elements, continuing anyway');
      this.logger.info('Attempting to proceed with partial author data extraction');
      // Add a small delay before continuing to ensure page is in a usable state
      await this.page.waitForTimeout(3000);
    }
  }

  async extractAuthorInfo() {
    try {
      // Check if page is still open
      if (this.page.isClosed()) {
        throw new Error('Page has been closed');
      }

      // Add wait for page stability
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      
      const authorInfo = await this.page.evaluate((selectors) => {
        const name = document.querySelector(selectors.AUTHOR.NAME)?.textContent?.trim() || '';
        const bio = document.querySelector(selectors.AUTHOR.BIO)?.textContent?.trim() || '';
        const followers = document.querySelector(selectors.AUTHOR.FOLLOWERS)?.textContent?.trim() || '0';
        const following = document.querySelector(selectors.AUTHOR.FOLLOWING)?.textContent?.trim() || '0';
        const avatar = document.querySelector(selectors.AUTHOR.AVATAR)?.src || '';
        const username = document.querySelector(selectors.AUTHOR.USERNAME)?.textContent?.trim() || '';
        
        // Extract social links
        const socialLinks = Array.from(document.querySelectorAll(selectors.AUTHOR.SOCIAL_LINKS))
          .map(link => ({
            platform: link.getAttribute('aria-label') || link.textContent?.trim() || 'unknown',
            url: link.href || ''
          }));
        
        // Extract publication info if available
        const publications = Array.from(document.querySelectorAll(selectors.AUTHOR.PUBLICATIONS))
          .map(pub => ({
            name: pub.textContent?.trim() || '',
            url: pub.href || '',
            role: pub.querySelector(selectors.AUTHOR.PUBLICATION_ROLE)?.textContent?.trim() || 'writer'
          }));
        
        return {
          name,
          bio,
          followers: parseInt(followers.replace(/[^\d]/g, ''), 10) || 0,
          following: parseInt(following.replace(/[^\d]/g, ''), 10) || 0,
          avatar,
          username,
          socialLinks,
          publications,
          url: window.location.href
        };
      }, SELECTORS);
      
      // Clean and validate data
      return {
        ...authorInfo,
        followers: authorInfo.followers || 0,
        following: authorInfo.following || 0,
        name: cleanText(authorInfo.name),
        bio: cleanText(authorInfo.bio)
      };
      
    } catch (error) {
      this.logger.error('Failed to extract author info', error);
      // Return default/empty author info instead of throwing
      return {
        name: 'Unknown',
        bio: '',
        followers: 0,
        following: 0,
        avatar: '',
        username: '',
        socialLinks: [],
        publications: [],
        url: this.page.url()
      };
    }
  }

  async extractAuthorArticles() {
    try {
      this.logger.info('Starting to extract author articles');
      
      // First, let's see what elements are actually on the page
      const pageContent = await this.page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          articleCount: document.querySelectorAll('article').length,
          linkCount: document.querySelectorAll('a[href*="/@"]').length,
          postCount: document.querySelectorAll('[data-testid*="post"], [data-testid*="article"]').length,
          allLinks: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
            href: a.href,
            text: a.textContent?.trim().substring(0, 50)
          })),
          // Add more detailed analysis
          articleElements: document.querySelectorAll('article').length,
          h2Elements: document.querySelectorAll('h2').length,
          h3Elements: document.querySelectorAll('h3').length,
          linksWithAt: document.querySelectorAll('a[href*="/@"]').length,
          dataTestIdElements: document.querySelectorAll('[data-testid]').length
        };
      });
      
      this.logger.info('Page content analysis:', pageContent);
      
      const articles = [];
      let hasMore = true;
      let scrollCount = 0;
      const maxScrolls = 10; // Reduced for testing
      
      while (hasMore && scrollCount < maxScrolls && articles.length < this.input.maxPosts) {
        this.logger.info(`Scroll ${scrollCount + 1}: Looking for articles...`);
        
        // Extract current articles
        const currentArticles = await this.extractArticlesFromCurrentView();
        this.logger.info(`Found ${currentArticles.length} articles in current view`);
        
        // Add new articles
        const newArticles = currentArticles.filter(article => 
          !articles.some(existing => existing.url === article.url)
        );
        
        articles.push(...newArticles);
        this.logger.info(`Total articles so far: ${articles.length}`);
        
        // Check if we have enough articles
        if (articles.length >= this.input.maxPosts) {
          break;
        }
        
        // Try to load more articles
        hasMore = await this.loadMoreArticles();
        scrollCount++;
        
        // Random delay between scrolls
        await this.page.waitForTimeout(1000 + Math.random() * 2000);
      }
      
      this.logger.info(`Extracted ${articles.length} articles from author page`);
      return articles;
      
    } catch (error) {
      this.logger.error('Failed to extract author articles', error);
      throw error;
    }
  }

  async extractArticlesFromCurrentView() {
    try {
      const result = await this.page.evaluate((selectors) => {
        const articles = [];
        
        // Let's check what elements are actually on the page
        const pageAnalysis = {
          articleElements: document.querySelectorAll('article').length,
          linksWithAt: document.querySelectorAll('a[href*="/@"]').length,
          h2Elements: document.querySelectorAll('h2').length,
          h3Elements: document.querySelectorAll('h3').length,
          dataTestIdElements: document.querySelectorAll('[data-testid]').length,
          allLinks: Array.from(document.querySelectorAll('a')).slice(0, 5).map(a => ({
            href: a.href,
            text: a.textContent?.trim().substring(0, 30)
          }))
        };
        
        // Try different approaches to find article elements
        let articleElements = document.querySelectorAll(selectors.AUTHOR.ARTICLE_LINKS);
        
        // If no elements found, try alternative selectors
        if (articleElements.length === 0) {
          articleElements = document.querySelectorAll('article a');
        }
        
        if (articleElements.length === 0) {
          articleElements = document.querySelectorAll('article h2 a, article h3 a');
        }
        
        if (articleElements.length === 0) {
          articleElements = document.querySelectorAll('[data-testid*="post"] a, [data-testid*="article"] a');
        }
        
        // Process each article element
        articleElements.forEach((element, index) => {
          try {
            // Try multiple approaches to find title
            let title = '';
            const titleSelectors = [
              selectors.AUTHOR.ARTICLE_TITLE,
              'h2', 'h3', 'h1',
              '[data-testid*="title"]',
              '.pw-post-title'
            ];
            
            for (const selector of titleSelectors) {
              const titleElement = element.querySelector(selector);
              if (titleElement) {
                title = titleElement.textContent?.trim() || '';
                break;
              }
            }
            
            // If no title found in element, check if the element itself is a title link
            if (!title && element.tagName === 'A' && element.textContent?.trim()) {
              title = element.textContent.trim();
            }
            
            const url = element.href || '';
            
            // Try to find other elements more broadly
            const subtitle = element.closest('article')?.querySelector('p, div:not([data-testid])')?.textContent?.trim() || '';
            const date = element.closest('article')?.querySelector('time, [data-testid*="date"]')?.textContent?.trim() || '';
            const readTime = element.closest('article')?.querySelector('[data-testid*="time"], [data-testid*="read"]')?.textContent?.trim() || '';
            
            if (title && url) {
              articles.push({
                title,
                subtitle,
                url,
                date,
                readTime,
                claps: 0,
                responses: 0,
                tags: [],
                publication: {
                  name: '',
                  url: ''
                },
                image: '',
                isPremium: false,
                index,
                scrapedAt: new Date().toISOString()
              });
            }
          } catch (error) {
            // Silently continue if individual article extraction fails
          }
        });
        
        // Return both the analysis and the articles found
        return {
          pageAnalysis,
          foundElements: articleElements.length,
          articles: articles
        };
        
      }, SELECTORS);
      
      return result.articles;
      
    } catch (error) {
      this.logger.error('Failed to extract articles from current view', error);
      return [];
    }
  }

  async loadMoreArticles() {
    try {
      return await this.page.evaluate((selectors) => {
        // Look for "Show more" or "Load more" buttons
        const loadMoreButton = document.querySelector(selectors.AUTHOR.LOAD_MORE_BUTTON);
        if (loadMoreButton && !loadMoreButton.disabled) {
          loadMoreButton.click();
          return true;
        }
        
        // Check if we can scroll to load more
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        
        // If we're near the bottom, scroll down
        if (scrollHeight - scrollTop - clientHeight < 500) {
          window.scrollTo(0, scrollHeight);
          return true;
        }
        
        return false;
      }, SELECTORS);
      
    } catch (error) {
      this.logger.warn('Failed to load more articles', error);
      return false;
    }
  }

  filterArticles(articles) {
    try {
      let filtered = [...articles];
      
      // Filter by tags if specified
      if (this.input.tags && this.input.tags.length > 0) {
        filtered = filtered.filter(article => {
          if (!article.tags || article.tags.length === 0) return false;
          return this.input.tags.some(tag => 
            article.tags.some(articleTag => 
              articleTag.toLowerCase().includes(tag.toLowerCase()) ||
              tag.toLowerCase().includes(articleTag.toLowerCase())
            )
          );
        });
      }
      
      // Filter by date range if specified
      if (this.input.dateRange) {
        filtered = filtered.filter(article => {
          try {
            const articleDate = new Date(article.date);
            const startDate = this.input.dateRange.start ? new Date(this.input.dateRange.start) : null;
            const endDate = this.input.dateRange.end ? new Date(this.input.dateRange.end) : null;
            
            if (startDate && articleDate < startDate) return false;
            if (endDate && articleDate > endDate) return false;
            return true;
          } catch {
            return true; // Include articles with invalid dates
          }
        });
      }
      
      // Filter premium content if not allowed
      if (!this.input.premiumContent) {
        filtered = filtered.filter(article => !article.isPremium);
      }
      
      // Sort articles
      if (this.input.sortBy === 'popular') {
        filtered.sort((a, b) => (b.claps + b.responses) - (a.claps + a.responses));
      } else if (this.input.sortBy === 'oldest') {
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
      } else { // latest
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      
      // Limit to max posts
      filtered = filtered.slice(0, this.input.maxPosts);
      
      this.logger.info(`Filtered ${articles.length} articles to ${filtered.length} based on criteria`);
      return filtered;
      
    } catch (error) {
      this.logger.error('Failed to filter articles', error);
      return articles.slice(0, this.input.maxPosts); // Return unfiltered articles as fallback
    }
  }
}