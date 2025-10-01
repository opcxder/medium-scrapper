import { createLogger } from '../utils/logger.js';
import { MEDIUM_CONSTANTS, SELECTORS, ERROR_MESSAGES } from '../config/constants.js';
import { cleanText, extractReadingTime, formatDate, calculateReadTime } from '../utils/contentProcessor.js';

export class ArticleScraper {
  constructor(page, input = {}, paywallInfo = {}) {
    this.page = page;
    this.input = input;
    this.paywallInfo = paywallInfo;
    this.logger = createLogger({ scraper: 'ArticleScraper', url: page.url() });
  }

  async scrapeArticle() {
    try {
      this.logger.info('Starting article scraping');
      
      // Wait for article page to load
      await this.waitForArticlePage();
      
      // Extract basic article information
      const articleInfo = await this.extractArticleInfo();
      
      if (!articleInfo) {
        throw new Error('Failed to extract article information');
      }
      
      // Extract content if requested
      let content = null;
      if (this.input.includeContent) {
        content = await this.extractArticleContent();
      }
      
      // Extract comments if requested
      let comments = null;
      if (this.input.includeComments) {
        comments = await this.extractArticleComments();
      }
      
      // Extract publication info if requested
      let publication = null;
      if (this.input.includePublication) {
        publication = await this.extractPublicationInfo();
      }
      
      return {
        ...articleInfo,
        content,
        comments,
        publication,
        paywallInfo: this.paywallInfo,
        scrapedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Article scraping failed', error);
      throw error;
    }
  }

  async waitForArticlePage() {
    try {
      // Wait for article title to load
      await this.page.waitForSelector(SELECTORS.ARTICLE.TITLE, { 
        timeout: MEDIUM_CONSTANTS.PAGE_TIMEOUT,
        state: 'visible'
      });
      
      // Wait for article content to appear
      await this.page.waitForSelector(SELECTORS.ARTICLE.CONTENT, { 
        timeout: MEDIUM_CONSTANTS.PAGE_TIMEOUT,
        state: 'visible'
      });
      
      // Additional wait for dynamic content
      await this.page.waitForTimeout(1000 + Math.random() * 1000);
      
    } catch (error) {
      this.logger.warn('Timeout waiting for article page elements, continuing anyway');
    }
  }

  async extractArticleInfo() {
    try {
      const articleInfo = await this.page.evaluate((selectors) => {
        // First try to extract data from Apollo state
        let apolloData = null;
        try {
          // Extract Apollo state data
          const apolloScript = document.querySelector('script:contains("__APOLLO_STATE__")');
          if (apolloScript) {
            const scriptContent = apolloScript.innerHTML;
            const apolloStateMatch = scriptContent.match(/window\.__APOLLO_STATE__\s*=\s*(\{.*\})/s);
            
            if (apolloStateMatch && apolloStateMatch[1]) {
              const apolloState = JSON.parse(apolloStateMatch[1]);
              
              // Find post reference in ROOT_QUERY
              const rootQuery = apolloState.ROOT_QUERY;
              const postKey = Object.keys(rootQuery).find(k => k.startsWith("post("));
              
              if (postKey && rootQuery[postKey].__ref) {
                const postRef = rootQuery[postKey].__ref;
                const post = apolloState[postRef];
                
                if (post) {
                  // Extract post data
                  apolloData = {
                    title: post.title || '',
                    subtitle: post.subtitle || '',
                    author: post.creator?.name || '',
                    authorUrl: post.creator?.username ? `https://medium.com/@${post.creator.username}` : '',
                    date: post.firstPublishedAt || post.createdAt || '',
                    readTime: post.readingTime || '',
                    claps: post.clapCount || 0,
                    responses: post.responseCount || 0,
                    tags: (post.tags || []).map(tag => tag.name || '').filter(Boolean),
                    publication: {
                      name: post.collection?.name || '',
                      url: post.collection?.slug ? `https://medium.com/${post.collection.slug}` : ''
                    },
                    mainImage: post.previewImage?.id ? `https://miro.medium.com/${post.previewImage.id}` : '',
                    isPremium: post.isLocked || post.isMembers || false,
                    url: window.location.href,
                    series: post.sequence ? {
                      name: post.sequence.title || '',
                      url: post.sequence.slug ? `https://medium.com/sequence/${post.sequence.slug}` : '',
                      part: post.sequenceIndex || ''
                    } : null,
                    // Store paragraph references for content extraction
                    paragraphRefs: post.content?.bodyModel?.paragraphs || []
                  };
                  
                  // Store the Apollo state for content extraction
                  window.__EXTRACTED_APOLLO_STATE__ = apolloState;
                  return apolloData;
                }
              }
            }
          }
        } catch (apolloError) {
          console.error('Error extracting Apollo data:', apolloError);
        }
        
        // Fallback to DOM-based extraction if Apollo extraction fails
        const title = document.querySelector(selectors.ARTICLE.TITLE)?.textContent?.trim() || '';
        const subtitle = document.querySelector(selectors.ARTICLE.SUBTITLE)?.textContent?.trim() || '';
        const author = document.querySelector(selectors.ARTICLE.AUTHOR)?.textContent?.trim() || '';
        const authorUrl = document.querySelector(selectors.ARTICLE.AUTHOR)?.href || '';
        const date = document.querySelector(selectors.ARTICLE.DATE)?.textContent?.trim() || '';
        const readTime = document.querySelector(selectors.ARTICLE.READ_TIME)?.textContent?.trim() || '';
        const claps = document.querySelector(selectors.ARTICLE.CLAPS)?.textContent?.trim() || '0';
        const responses = document.querySelector(selectors.ARTICLE.RESPONSES)?.textContent?.trim() || '0';
        
        // Extract tags
        const tags = Array.from(document.querySelectorAll(selectors.ARTICLE.TAGS))
          .map(tag => tag.textContent?.trim())
          .filter(Boolean);
        
        // Extract publication info
        const publicationName = document.querySelector(selectors.ARTICLE.PUBLICATION)?.textContent?.trim() || '';
        const publicationUrl = document.querySelector(selectors.ARTICLE.PUBLICATION)?.href || '';
        
        // Extract main image
        const mainImage = document.querySelector(selectors.ARTICLE.MAIN_IMAGE)?.src || '';

        // Determine if premium content
        const premiumIndicators = document.querySelectorAll(selectors.ARTICLE.PREMIUM_INDICATORS);
        const isPremium = premiumIndicators.length > 0;
        
        // Extract URL
        const url = window.location.href;
        
        // Extract series info if available
        const seriesName = document.querySelector(selectors.ARTICLE.SERIES_NAME)?.textContent?.trim() || '';
        const seriesUrl = document.querySelector(selectors.ARTICLE.SERIES_NAME)?.href || '';
        const seriesPart = document.querySelector(selectors.ARTICLE.SERIES_PART)?.textContent?.trim() || '';
        
        return {
          title,
          subtitle,
          author,
          authorUrl,
          date,
          readTime,
          claps: parseInt(claps.replace(/[^\d]/g, ''), 10) || 0,
          responses: parseInt(responses.replace(/[^\d]/g, ''), 10) || 0,
          tags,
          publication: {
            name: publicationName,
            url: publicationUrl
          },
          mainImage,
          isPremium,
          url,
          series: seriesName ? {
            name: seriesName,
            url: seriesUrl,
            part: seriesPart
          } : null
        };
      }, SELECTORS);
      
      // Clean and validate data
      return {
        ...articleInfo,
        title: cleanText(articleInfo.title),
        subtitle: cleanText(articleInfo.subtitle),
        author: cleanText(articleInfo.author),
        date: this.parseArticleDate(articleInfo.date),
        readTime: extractReadingTime(articleInfo.readTime),
        url: this.page.url()
      };
      
    } catch (error) {
      this.logger.error('Failed to extract article info', error);
      throw error;
    }
  }

  parseArticleDate(dateText) {
    try {
      if (!dateText) return null;
      
      // Handle various date formats
      const datePatterns = [
        /(\w+)\s+(\d{1,2}),\s+(\d{4})/, // "January 1, 2024"
        /(\d{1,2})\s+(\w+)\s+(\d{4})/, // "1 January 2024"
        /(\w+)\s+(\d{1,2})/, // "January 1"
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // "01/01/2024"
        /(\d{4})-(\d{1,2})-(\d{1,2})/ // "2024-01-01"
      ];
      
      for (const pattern of datePatterns) {
        const match = dateText.match(pattern);
        if (match) {
          const dateStr = match[0];
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
      }
      
      // Try parsing as relative date (e.g., "2 days ago")
      const relativeMatch = dateText.match(/(\d+)\s+(\w+)\s+ago/);
      if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2];
        const now = new Date();
        
        switch (unit) {
          case 'second':
          case 'seconds':
            now.setSeconds(now.getSeconds() - amount);
            break;
          case 'minute':
          case 'minutes':
            now.setMinutes(now.getMinutes() - amount);
            break;
          case 'hour':
          case 'hours':
            now.setHours(now.getHours() - amount);
            break;
          case 'day':
          case 'days':
            now.setDate(now.getDate() - amount);
            break;
          case 'week':
          case 'weeks':
            now.setDate(now.getDate() - (amount * 7));
            break;
          case 'month':
          case 'months':
            now.setMonth(now.getMonth() - amount);
            break;
          case 'year':
          case 'years':
            now.setFullYear(now.getFullYear() - amount);
            break;
        }
        
        return now.toISOString();
      }
      
      // Fallback: try parsing the entire text as a date
      const fallbackDate = new Date(dateText);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate.toISOString();
      }
      
      return null;
      
    } catch (error) {
      this.logger.warn(`Failed to parse date: ${dateText}`, error);
      return null;
    }
  }

  async extractArticleContent() {
    try {
      // Scroll through the article to load all content
      await this.scrollThroughArticle();
      
      const content = await this.page.evaluate((selectors) => {
        // First try to extract content from Apollo state
        if (window.__EXTRACTED_APOLLO_STATE__) {
          try {
            const apolloState = window.__EXTRACTED_APOLLO_STATE__;
            const content = [];
            
            // Find all paragraph references
            const paragraphRefs = Object.keys(apolloState).filter(key => key.startsWith('Paragraph:'));
            if (paragraphRefs.length > 0) {
              // Process each paragraph
              const processedParagraphs = paragraphRefs.map(ref => {
                const paragraph = apolloState[ref];
                if (!paragraph) return null;
                
                // Extract paragraph data based on type
                const type = paragraph.type || '';
                const text = paragraph.text || '';
                
                // Process based on paragraph type
                switch (type) {
                  case 'H1':
                  case 'H2':
                  case 'H3':
                  case 'H4':
                    return { type: 'heading', level: parseInt(type.substring(1), 10), text };
                  case 'P':
                    return { type: 'paragraph', text };
                  case 'BQ':
                    return { type: 'quote', text };
                  case 'PRE':
                    return { type: 'code', language: paragraph.codeBlockMetadata?.lang || 'unknown', code: text };
                  case 'IMG':
                    // Handle image - find image metadata
                    let imageData = { type: 'image', alt: '', src: '' };
                    if (paragraph.metadata && paragraph.metadata.__ref) {
                      const imageRef = paragraph.metadata.__ref;
                      const imageMetadata = apolloState[imageRef];
                      if (imageMetadata) {
                        imageData.alt = imageMetadata.alt || '';
                        imageData.src = imageMetadata.id ? `https://miro.medium.com/${imageMetadata.id}` : '';
                      }
                    }
                    return imageData;
                  case 'OL':
                  case 'UL':
                    // Handle lists - need to extract items
                    return { 
                      type: 'list', 
                      listType: type.toLowerCase(),
                      items: paragraph.text ? paragraph.text.split('\n').filter(Boolean) : []
                    };
                  default:
                    return { type: 'unknown', text };
                }
              }).filter(Boolean);
              
              // Organize content
              let textContent = '';
              const headings = [];
              const paragraphs = [];
              const lists = [];
              const quotes = [];
              const codeBlocks = [];
              const images = [];
              const links = [];
              
              // Process each paragraph
              processedParagraphs.forEach(p => {
                if (p.text) textContent += p.text + ' ';
                
                switch (p.type) {
                  case 'heading':
                    headings.push({ level: p.level, text: p.text });
                    break;
                  case 'paragraph':
                    paragraphs.push(p.text);
                    break;
                  case 'quote':
                    quotes.push({ text: p.text, author: '' });
                    break;
                  case 'code':
                    codeBlocks.push({ language: p.language, code: p.code });
                    break;
                  case 'image':
                    images.push({ src: p.src, alt: p.alt, caption: '' });
                    break;
                  case 'list':
                    lists.push({ type: p.listType, items: p.items });
                    break;
                }
              });
              
              // Add to content
              content.push({
                textContent,
                headings,
                paragraphs,
                lists,
                quotes,
                codeBlocks,
                images,
                links,
                wordCount: textContent.split(/\s+/).filter(word => word.length > 0).length
              });
              
              return content;
            }
          } catch (apolloError) {
            console.error('Error extracting content from Apollo state:', apolloError);
          }
        }
        
        // Fallback to DOM-based extraction if Apollo extraction fails
        const contentElements = document.querySelectorAll(selectors.ARTICLE.CONTENT);
        const content = [];
        
        contentElements.forEach(element => {
          try {
            // Extract text content
            const textContent = element.textContent?.trim() || '';
            
            // Extract headings
            const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'))
              .map(h => ({
                level: parseInt(h.tagName.substring(1), 10),
                text: h.textContent?.trim() || ''
              }));
            
            // Extract paragraphs
            const paragraphs = Array.from(element.querySelectorAll('p'))
              .map(p => p.textContent?.trim())
              .filter(Boolean);
            
            // Extract lists
            const lists = Array.from(element.querySelectorAll('ul, ol'))
              .map(list => ({
                type: list.tagName.toLowerCase(),
                items: Array.from(list.querySelectorAll('li'))
                  .map(li => li.textContent?.trim())
                  .filter(Boolean)
              }));
            
            // Extract quotes
            const quotes = Array.from(element.querySelectorAll('blockquote'))
              .map(blockquote => ({
                text: blockquote.textContent?.trim() || '',
                author: blockquote.querySelector('cite')?.textContent?.trim() || ''
              }));
            
            // Extract code blocks
            const codeBlocks = Array.from(element.querySelectorAll('pre, code'))
              .map(code => ({
                language: code.className?.match(/language-(\w+)/)?.[1] || 'unknown',
                code: code.textContent?.trim() || ''
              }));
            
            // Extract images
            const images = Array.from(element.querySelectorAll('img'))
              .map(img => ({
                src: img.src || '',
                alt: img.alt || '',
                caption: img.getAttribute('data-caption') || ''
              }));
            
            // Extract links
            const links = Array.from(element.querySelectorAll('a[href]'))
              .map(link => ({
                text: link.textContent?.trim() || '',
                url: link.href || '',
                title: link.title || ''
              }));
            
            content.push({
              textContent,
              headings,
              paragraphs,
              lists,
              quotes,
              codeBlocks,
              images,
              links,
              wordCount: textContent.split(/\s+/).filter(word => word.length > 0).length
            });
            
          } catch (error) {
            console.error('Error extracting content element:', error);
          }
        });
        
        return content;
      }, SELECTORS);
      
      // Flatten and clean content
      const flattenedContent = this.flattenContent(content);
      
      this.logger.info(`Extracted article content with ${flattenedContent.wordCount} words`);
      return flattenedContent;
      
    } catch (error) {
      this.logger.error('Failed to extract article content', error);
      return null;
    }
  }

  async scrollThroughArticle() {
    try {
      // Simulate reading behavior
      const scrollHeight = await this.page.evaluate(() => document.documentElement.scrollHeight);
      const viewportHeight = await this.page.evaluate(() => window.innerHeight);
      const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
      
      for (let i = 0; i < scrollSteps; i++) {
        const scrollPosition = i * viewportHeight;
        
        // Scroll to position
        await this.page.evaluate((pos) => {
          window.scrollTo(0, pos);
        }, scrollPosition);
        
        // Random pause to simulate reading
        const readingTime = 1000 + Math.random() * 2000;
        await this.page.waitForTimeout(readingTime);
        
        // Random mouse movement
        await this.page.mouse.move(
          100 + Math.random() * 800,
          100 + Math.random() * 600,
          { steps: 5 + Math.floor(Math.random() * 10) }
        );
      }
      
      // Scroll back to top
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
    } catch (error) {
      this.logger.warn('Failed to scroll through article', error);
    }
  }

  flattenContent(contentArray) {
    try {
      const flattened = {
        textContent: '',
        headings: [],
        paragraphs: [],
        lists: [],
        quotes: [],
        codeBlocks: [],
        images: [],
        links: [],
        wordCount: 0
      };
      
      contentArray.forEach(content => {
        flattened.textContent += (content.textContent || '') + ' ';
        flattened.headings.push(...(content.headings || []));
        flattened.paragraphs.push(...(content.paragraphs || []));
        flattened.lists.push(...(content.lists || []));
        flattened.quotes.push(...(content.quotes || []));
        flattened.codeBlocks.push(...(content.codeBlocks || []));
        flattened.images.push(...(content.images || []));
        flattened.links.push(...(content.links || []));
        flattened.wordCount += content.wordCount || 0;
      });
      
      // Clean text content
      flattened.textContent = cleanText(flattened.textContent);
      flattened.wordCount = flattened.textContent.split(/\s+/).filter(word => word.length > 0).length;
      
      return flattened;
      
    } catch (error) {
      this.logger.error('Failed to flatten content', error);
      return contentArray[0] || { textContent: '', wordCount: 0 };
    }
  }

  async extractArticleComments() {
    try {
      // Look for comments section
      const hasComments = await this.page.evaluate((selectors) => {
        return document.querySelector(selectors.ARTICLE.COMMENTS_SECTION) !== null;
      }, SELECTORS);
      
      if (!hasComments) {
        return [];
      }
      
      // Scroll to comments section
      await this.page.evaluate((selectors) => {
        const commentsSection = document.querySelector(selectors.ARTICLE.COMMENTS_SECTION);
        if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, SELECTORS);
      
      await this.page.waitForTimeout(2000); // Wait for comments to load
      
      const comments = await this.page.evaluate((selectors) => {
        const comments = [];
        const commentElements = document.querySelectorAll(selectors.ARTICLE.COMMENT);
        
        commentElements.forEach((element, index) => {
          try {
            const author = element.querySelector(selectors.ARTICLE.COMMENT_AUTHOR)?.textContent?.trim() || '';
            const authorUrl = element.querySelector(selectors.ARTICLE.COMMENT_AUTHOR)?.href || '';
            const content = element.querySelector(selectors.ARTICLE.COMMENT_CONTENT)?.textContent?.trim() || '';
            const date = element.querySelector(selectors.ARTICLE.COMMENT_DATE)?.textContent?.trim() || '';
            const claps = element.querySelector(selectors.ARTICLE.COMMENT_CLAPS)?.textContent?.trim() || '0';
            
            comments.push({
              author,
              authorUrl,
              content,
              date,
              claps: parseInt(claps.replace(/[^\d]/g, ''), 10) || 0,
              index
            });
            
          } catch (error) {
            console.error('Error extracting comment:', error);
          }
        });
        
        return comments;
      }, SELECTORS);
      
      this.logger.info(`Extracted ${comments.length} comments from article`);
      return comments;
      
    } catch (error) {
      this.logger.warn('Failed to extract article comments', error);
      return [];
    }
  }

  async extractPublicationInfo() {
    try {
      const publicationInfo = await this.page.evaluate((selectors) => {
        const publication = document.querySelector(selectors.ARTICLE.PUBLICATION);
        if (!publication) return null;
        
        const name = publication.textContent?.trim() || '';
        const url = publication.href || '';
        const logo = document.querySelector(selectors.ARTICLE.PUBLICATION_LOGO)?.src || '';
        const description = document.querySelector(selectors.ARTICLE.PUBLICATION_DESCRIPTION)?.textContent?.trim() || '';
        const followers = document.querySelector(selectors.ARTICLE.PUBLICATION_FOLLOWERS)?.textContent?.trim() || '0';
        
        return {
          name,
          url,
          logo,
          description,
          followers: parseInt(followers.replace(/[^\d]/g, ''), 10) || 0
        };
      }, SELECTORS);
      
      return publicationInfo;
      
    } catch (error) {
      this.logger.warn('Failed to extract publication info', error);
      return null;
    }
  }
}