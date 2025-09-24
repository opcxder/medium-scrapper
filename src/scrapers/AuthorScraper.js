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
    }
  }

  async extractAuthorInfo() {
    try {
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
      throw error;
    }
  }

  async extractAuthorArticles() {
    try {
      const articles = [];
      let hasMore = true;
      let scrollCount = 0;
      const maxScrolls = 50; // Prevent infinite scrolling
      
      while (hasMore && scrollCount < maxScrolls && articles.length < this.input.maxPosts) {
        // Extract current articles
        const currentArticles = await this.extractArticlesFromCurrentView();
        
        // Add new articles
        const newArticles = currentArticles.filter(article => 
          !articles.some(existing => existing.url === article.url)
        );
        
        articles.push(...newArticles);
        
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
      return await this.page.evaluate((selectors, input) => {
        const articles = [];
        const articleElements = document.querySelectorAll(selectors.AUTHOR.ARTICLE_LINKS);
        
        articleElements.forEach((element, index) => {
          try {
            const title = element.querySelector(selectors.AUTHOR.ARTICLE_TITLE)?.textContent?.trim() || '';
            const subtitle = element.querySelector(selectors.AUTHOR.ARTICLE_SUBTITLE)?.textContent?.trim() || '';
            const url = element.href || '';
            const date = element.querySelector(selectors.AUTHOR.ARTICLE_DATE)?.textContent?.trim() || '';
            const readTime = element.querySelector(selectors.AUTHOR.ARTICLE_READ_TIME)?.textContent?.trim() || '';
            const claps = element.querySelector(selectors.AUTHOR.ARTICLE_CLAPS)?.textContent?.trim() || '0';
            const responses = element.querySelector(selectors.AUTHOR.ARTICLE_RESPONSES)?.textContent?.trim() || '0';
            
            // Extract tags
            const tags = Array.from(element.querySelectorAll(selectors.AUTHOR.ARTICLE_TAGS))
              .map(tag => tag.textContent?.trim())
              .filter(Boolean);
            
            // Extract publication info
            const publication = element.querySelector(selectors.AUTHOR.ARTICLE_PUBLICATION)?.textContent?.trim() || '';
            const publicationUrl = element.querySelector(selectors.AUTHOR.ARTICLE_PUBLICATION)?.href || '';
            
            // Extract image
            const image = element.querySelector(selectors.AUTHOR.ARTICLE_IMAGE)?.src || '';
            
            // Determine if premium content
            const premiumIndicators = element.querySelectorAll(selectors.AUTHOR.PREMIUM_INDICATORS);
            const isPremium = premiumIndicators.length > 0;
            
            if (title && url) {
              articles.push({
                title,
                subtitle,
                url,
                date,
                readTime,
                claps: parseInt(claps.replace(/[^\d]/g, ''), 10) || 0,
                responses: parseInt(responses.replace(/[^\d]/g, ''), 10) || 0,
                tags,
                publication: {
                  name: publication,
                  url: publicationUrl
                },
                image,
                isPremium,
                index,
                scrapedAt: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error('Error extracting article:', error);
          }
        });
        
        return articles;
      }, SELECTORS, this.input);
      
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