import { SELECTORS, ERROR_MESSAGES } from '../config/constants.js';

export class PaywallDetector {
  constructor(options = {}) {
    this.options = {
      detectPremiumContent: true,
      detectMemberOnly: true,
      detectSubscriptionPrompts: true,
      handlePaywallGracefully: true,
      ...options
    };
    
    this.detectionStats = {
      totalArticles: 0,
      premiumArticles: 0,
      memberOnlyArticles: 0,
      paywallHits: 0,
      bypassAttempts: 0,
      successfulBypasses: 0
    };
  }

  async detectPaywall(page) {
    try {
      this.detectionStats.totalArticles++;
      
      const paywallIndicators = await Promise.all([
        this.detectPremiumContent(page),
        this.detectMemberOnlyContent(page),
        this.detectSubscriptionPrompts(page),
        this.detectContentTruncation(page),
        this.detectLoginRequirements(page)
      ]);

      const paywallType = this.determinePaywallType(paywallIndicators);
      
      if (paywallType) {
        this.detectionStats.paywallHits++;
        console.log(`Paywall detected: ${paywallType}`);
      }

      return {
        hasPaywall: paywallType !== null,
        paywallType,
        indicators: paywallIndicators,
        confidence: this.calculateConfidence(paywallIndicators)
      };
    } catch (error) {
      console.error('Paywall detection failed:', error.message);
      return {
        hasPaywall: false,
        paywallType: null,
        indicators: [],
        confidence: 0,
        error: error.message
      };
    }
  }

  async detectPremiumContent(page) {
    if (!this.options.detectPremiumContent) return null;

    try {
      const premiumSelectors = [
        SELECTORS.PAYWALL_INDICATOR,
        SELECTORS.MEMBER_ONLY_BADGE,
        'div[data-testid="premiumContent"]',
        'span:contains("Member-only")',
        'span:contains("Premium")'
      ];

      for (const selector of premiumSelectors) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            this.detectionStats.premiumArticles++;
            return {
              type: 'premium',
              selector,
              element: await element.textContent()
            };
          }
        }
      }
    } catch (error) {
      console.warn('Premium content detection failed:', error.message);
    }

    return null;
  }

  async detectMemberOnlyContent(page) {
    if (!this.options.detectMemberOnly) return null;

    try {
      const memberOnlySelectors = [
        SELECTORS.MEMBER_ONLY_BADGE,
        'span:contains("Member-only story")',
        'div:contains("This story is for Medium members only")',
        'button:contains("Upgrade to Medium membership")',
        'a:contains("Join Medium")'
      ];

      for (const selector of memberOnlySelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const isVisible = await element.isVisible();
            if (isVisible) {
              this.detectionStats.memberOnlyArticles++;
              return {
                type: 'member_only',
                selector,
                element: await element.textContent()
              };
            }
          }
        } catch (innerError) {
          // Continue with next selector if this one fails
          continue;
        }
      }
    } catch (error) {
      console.warn('Member-only content detection failed:', error.message);
    }

    return null;
  }

  async detectSubscriptionPrompts(page) {
    if (!this.options.detectSubscriptionPrompts) return null;

    try {
      const subscriptionSelectors = [
        SELECTORS.CONTINUE_READING,
        SELECTORS.SUBSCRIPTION_PROMPT,
        'div:contains("Continue reading")',
        'button:contains("Continue reading")',
        'div:contains("Sign up for Medium")',
        'div:contains("Create an account")'
      ];

      for (const selector of subscriptionSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const isVisible = await element.isVisible();
            if (isVisible) {
              return {
                type: 'subscription_prompt',
                selector,
                element: await element.textContent()
              };
            }
          }
        } catch (innerError) {
          continue;
        }
      }
    } catch (error) {
      console.warn('Subscription prompt detection failed:', error.message);
    }

    return null;
  }

  async detectContentTruncation(page) {
    try {
      // Check if content appears to be truncated
      const contentLength = await page.evaluate(() => {
        const articleContent = document.querySelector('article, main, [data-testid="articleContent"]');
        return articleContent ? articleContent.textContent.length : 0;
      });

      // If content is unusually short, it might be truncated
      if (contentLength < 500) { // Less than 500 characters is suspicious
        return {
          type: 'content_truncation',
          contentLength,
          threshold: 500
        };
      }
    } catch (error) {
      console.warn('Content truncation detection failed:', error.message);
    }

    return null;
  }

  async detectLoginRequirements(page) {
    try {
      const loginSelectors = [
        'button:contains("Sign in")',
        'a:contains("Sign in")',
        'div:contains("Sign in to continue")',
        'div:contains("Login to continue")'
      ];

      for (const selector of loginSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const isVisible = await element.isVisible();
            if (isVisible) {
              return {
                type: 'login_required',
                selector,
                element: await element.textContent()
              };
            }
          }
        } catch (innerError) {
          continue;
        }
      }
    } catch (error) {
      console.warn('Login requirement detection failed:', error.message);
    }

    return null;
  }

  determinePaywallType(indicators) {
    const activeIndicators = indicators.filter(indicator => indicator !== null);
    
    if (activeIndicators.length === 0) {
      return null;
    }

    // Determine the most specific paywall type
    const types = activeIndicators.map(indicator => indicator.type);
    
    if (types.includes('premium')) {
      return 'premium';
    } else if (types.includes('member_only')) {
      return 'member_only';
    } else if (types.includes('subscription_prompt')) {
      return 'subscription_prompt';
    } else if (types.includes('login_required')) {
      return 'login_required';
    } else if (types.includes('content_truncation')) {
      return 'content_truncation';
    }

    return 'unknown';
  }

  calculateConfidence(indicators) {
    const activeIndicators = indicators.filter(indicator => indicator !== null);
    return Math.min(activeIndicators.length * 0.25, 1.0); // Max confidence of 1.0
  }

  async handlePaywall(page, paywallInfo) {
    if (!this.options.handlePaywallGracefully) {
      return { success: false, reason: 'Paywall handling disabled' };
    }

    this.detectionStats.bypassAttempts++;

    try {
      switch (paywallInfo.paywallType) {
        case 'premium':
          return await this.handlePremiumContent(page);
        case 'member_only':
          return await this.handleMemberOnlyContent(page);
        case 'subscription_prompt':
          return await this.handleSubscriptionPrompt(page);
        case 'login_required':
          return await this.handleLoginRequirement(page);
        default:
          return { success: false, reason: 'Unknown paywall type' };
      }
    } catch (error) {
      console.error('Paywall handling failed:', error.message);
      return { success: false, reason: error.message };
    }
  }

  async handlePremiumContent(page) {
    try {
      // Try to extract available content even with paywall
      const partialContent = await this.extractPartialContent(page);
      
      if (partialContent && partialContent.length > 100) {
        this.detectionStats.successfulBypasses++;
        return {
          success: true,
          method: 'partial_content_extraction',
          content: partialContent,
          note: 'Extracted partial content before paywall'
        };
      }

      return { success: false, reason: 'No partial content available' };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  async handleMemberOnlyContent(page) {
    try {
      // Try to bypass by checking if there's any accessible content
      const accessibleContent = await page.evaluate(() => {
        // Look for content that might be accessible
        const contentSelectors = [
          'article div[data-testid="articleContent"] > *:not([data-testid="paywall"])',
          'article > *:not([data-testid="paywall"])',
          'main > *:not([data-testid="paywall"])',
          '[data-testid="articleBody"] > *:not([data-testid="paywall"])'
        ];

        for (const selector of contentSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            return Array.from(elements).map(el => el.textContent).join('\n');
          }
        }
        return null;
      });

      if (accessibleContent) {
        this.detectionStats.successfulBypasses++;
        return {
          success: true,
          method: 'accessible_content_extraction',
          content: accessibleContent,
          note: 'Extracted accessible content sections'
        };
      }

      return { success: false, reason: 'No accessible content found' };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  async handleSubscriptionPrompt(page) {
    try {
      // Try to close subscription prompts
      const closeButtonSelectors = [
        'button[data-testid="closeButton"]',
        'button:contains("Close")',
        'button:contains("No thanks")',
        'button:contains("Maybe later")',
        '.close-button',
        '[data-testid="dismiss"]'
      ];

      for (const selector of closeButtonSelectors) {
        try {
          const button = await page.$(selector);
          if (button && await button.isVisible()) {
            await button.click();
            await page.waitForTimeout(1000);
            
            // Check if content is now accessible
            const content = await this.extractPartialContent(page);
            if (content) {
              this.detectionStats.successfulBypasses++;
              return {
                success: true,
                method: 'prompt_dismissal',
                content,
                note: 'Dismissed subscription prompt and extracted content'
              };
            }
          }
        } catch (innerError) {
          continue;
        }
      }

      return { success: false, reason: 'Could not dismiss subscription prompt' };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  async handleLoginRequirement(page) {
    // For login requirements, we can't bypass without credentials
    // But we can try to extract any publicly available content
    try {
      const publicContent = await this.extractPartialContent(page);
      
      if (publicContent) {
        return {
          success: true,
          method: 'public_content_extraction',
          content: publicContent,
          note: 'Extracted publicly available content only'
        };
      }

      return { success: false, reason: 'Login required - no public content available' };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  async extractPartialContent(page) {
    try {
      return await page.evaluate(() => {
        const contentSelectors = [
          'article p',
          'article h1',
          'article h2',
          'article h3',
          'main p',
          'main h1',
          'main h2',
          'main h3',
          '[data-testid="articleContent"] p',
          '[data-testid="articleBody"] p'
        ];

        let content = '';
        for (const selector of contentSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            content += Array.from(elements)
              .map(el => el.textContent.trim())
              .filter(text => text.length > 10)
              .join('\n\n');
            break;
          }
        }

        return content.length > 50 ? content : null;
      });
    } catch (error) {
      console.warn('Partial content extraction failed:', error.message);
      return null;
    }
  }

  getStats() {
    return {
      ...this.detectionStats,
      paywallRate: this.detectionStats.totalArticles > 0 
        ? (this.detectionStats.paywallHits / this.detectionStats.totalArticles * 100).toFixed(2)
        : 0,
      bypassSuccessRate: this.detectionStats.bypassAttempts > 0
        ? (this.detectionStats.successfulBypasses / this.detectionStats.bypassAttempts * 100).toFixed(2)
        : 0
    };
  }

  resetStats() {
    this.detectionStats = {
      totalArticles: 0,
      premiumArticles: 0,
      memberOnlyArticles: 0,
      paywallHits: 0,
      bypassAttempts: 0,
      successfulBypasses: 0
    };
  }
}

export default PaywallDetector;