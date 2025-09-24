import { getRandomUserAgent } from './userAgentManager.js';
import { MEDIUM_CONSTANTS } from '../config/constants.js';

export class StealthHelper {
  constructor(options = {}) {
    this.options = {
      enableBehavioralSimulation: true,
      enableFingerprintRandomization: true,
      enableMouseMovement: true,
      enableScrollSimulation: true,
      enableTimingRandomization: true,
      ...options
    };
    
    this.behavioralPatterns = this.generateBehavioralPatterns();
    this.mouseMovementGenerator = new MouseMovementGenerator();
    this.scrollSimulator = new ScrollSimulator();
  }

  generateBehavioralPatterns() {
    return {
      readingSpeed: this.generateReadingSpeed(),
      scrollPatterns: this.generateScrollPatterns(),
      mouseMovement: this.generateMouseMovementPatterns(),
      interactionTiming: this.generateInteractionTiming()
    };
  }

  generateReadingSpeed() {
    // Realistic reading speeds (words per minute)
    const speeds = [180, 200, 220, 250, 280, 300, 320, 350];
    return speeds[Math.floor(Math.random() * speeds.length)];
  }

  generateScrollPatterns() {
    return {
      fastScroll: { min: 300, max: 800, delay: 100 },
      normalScroll: { min: 100, max: 300, delay: 200 },
      slowScroll: { min: 50, max: 150, delay: 400 },
      pauseDuration: { min: 1000, max: 5000 }
    };
  }

  generateMouseMovementPatterns() {
    return {
      movementSpeed: { min: 0.5, max: 2.0 },
      pauseDuration: { min: 100, max: 1000 },
      curveIntensity: { min: 0.1, max: 0.5 }
    };
  }

  generateInteractionTiming() {
    return {
      clickDelay: { min: 100, max: 500 },
      hoverDuration: { min: 500, max: 2000 },
      scrollDelay: { min: 200, max: 1000 }
    };
  }

  async applyStealthToPage(page) {
    try {
      // Apply basic stealth settings
      await this.applyBasicStealth(page);
      
      // Apply advanced stealth if enabled
      if (this.options.enableFingerprintRandomization) {
        await this.applyFingerprintRandomization(page);
      }
      
      if (this.options.enableBehavioralSimulation) {
        await this.setupBehavioralSimulation(page);
      }
      
      // Advanced stealth settings applied to page
    } catch (error) {
      console.error('Failed to apply stealth settings:', error.message);
    }
  }

  async applyBasicStealth(page) {
    try {
      // Remove automation indicators
      await page.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            },
            {
              0: { type: "application/pdf", suffixes: "pdf", description: "" },
              description: "",
              filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
              length: 1,
              name: "Chrome PDF Viewer"
            }
          ],
          configurable: true
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'es', 'fr'],
          configurable: true
        });

        // Mock platform
        const platforms = ['Win32', 'MacIntel', 'Linux x86_64', 'X11'];
        const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
        Object.defineProperty(navigator, 'platform', {
          get: () => randomPlatform,
          configurable: true
        });

        // Mock user agent
        const userAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        Object.defineProperty(navigator, 'userAgent', {
          get: () => randomUserAgent,
          configurable: true
        });
      });
    } catch (error) {
      console.error('Failed to apply basic stealth settings:', error.message);
    }
  }

  async applyFingerprintRandomization(page) {
    try {
      await page.addInitScript(() => {
        // Randomize screen dimensions
        const screenSizes = [
          { width: 1920, height: 1080 },
          { width: 1366, height: 768 },
          { width: 1440, height: 900 },
          { width: 1536, height: 864 },
          { width: 1280, height: 720 }
        ];
        const randomScreen = screenSizes[Math.floor(Math.random() * screenSizes.length)];
        
        Object.defineProperty(screen, 'width', {
          get: () => randomScreen.width,
          configurable: true
        });
        Object.defineProperty(screen, 'height', {
          get: () => randomScreen.height,
          configurable: true
        });
        Object.defineProperty(screen, 'availWidth', {
          get: () => randomScreen.width,
          configurable: true
        });
        Object.defineProperty(screen, 'availHeight', {
          get: () => randomScreen.height - 100, // Account for taskbar
          configurable: true
        });

        // Randomize color depth
        const colorDepths = [24, 30, 32];
        Object.defineProperty(screen, 'colorDepth', {
          get: () => colorDepths[Math.floor(Math.random() * colorDepths.length)],
          configurable: true
        });

        // Randomize timezone
        const timezones = ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];
        const randomTimezone = timezones[Math.floor(Math.random() * timezones.length)];
        
        // Override Date methods
        const OriginalDate = Date;
        const timezoneOffset = getTimezoneOffset(randomTimezone);
        
        function getTimezoneOffset(timezone) {
          const date = new OriginalDate();
          const utc = new OriginalDate(date.getTime() + (date.getTimezoneOffset() * 60000));
          const target = new OriginalDate(utc.toLocaleString("en-US", {timeZone: timezone}));
          return (utc - target) / (1000 * 60);
        }

        Date.prototype.getTimezoneOffset = function() {
          return timezoneOffset;
        };

        // Mock WebGL
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        const vendors = ['Intel Inc.', 'NVIDIA Corporation', 'ATI Technologies Inc.'];
        const renderers = ['Intel Iris OpenGL Engine', 'NVIDIA GeForce GTX 1080', 'AMD Radeon Pro 580'];
        
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return vendors[Math.floor(Math.random() * vendors.length)];
          }
          if (parameter === 37446) {
            return renderers[Math.floor(Math.random() * renderers.length)];
          }
          return getParameter.call(this, parameter);
        };

        // Mock canvas fingerprint
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
          if (type === 'image/webp') {
            return 'data:image/webp;base64,' + Math.random().toString(36).substring(2, 15);
          }
          return originalToDataURL.apply(this, arguments);
        };
      });
    } catch (error) {
      console.error('Failed to apply fingerprint randomization:', error.message);
    }
  }

  async setupBehavioralSimulation(page) {
    // Add realistic mouse movement simulation
    if (this.options.enableMouseMovement) {
      await this.setupMouseMovement(page);
    }
    
    // Add realistic scroll simulation
    if (this.options.enableScrollSimulation) {
      await this.setupScrollSimulation(page);
    }
    
    // Add timing randomization
    if (this.options.enableTimingRandomization) {
      await this.setupTimingRandomization(page);
    }
  }

  async setupMouseMovement(page) {
    try {
      await page.addInitScript((patterns) => {
        let lastMouseMove = 0;
        const mouseMovement = {
          movementX: 0,
          movementY: 0,
          clientX: Math.floor(Math.random() * window.innerWidth),
          clientY: Math.floor(Math.random() * window.innerHeight)
        };

        // Override mouse event properties
        document.addEventListener('mousemove', (event) => {
          const now = Date.now();
          if (now - lastMouseMove > 50) { // Throttle to realistic intervals
            mouseMovement.movementX = (Math.random() - 0.5) * 10;
            mouseMovement.movementY = (Math.random() - 0.5) * 10;
            mouseMovement.clientX = Math.min(window.innerWidth, Math.max(0, mouseMovement.clientX + mouseMovement.movementX));
            mouseMovement.clientY = Math.min(window.innerHeight, Math.max(0, mouseMovement.clientY + mouseMovement.movementY));
            lastMouseMove = now;
          }
        }, true);
      }, this.behavioralPatterns);
    } catch (error) {
      console.error('Failed to setup mouse movement:', error.message);
    }
  }

  async setupScrollSimulation(page) {
    try {
      await page.addInitScript((patterns) => {
        let scrollTop = 0;
        let scrollLeft = 0;
        let lastScrollTime = 0;

        // Mock scroll properties with realistic behavior
        Object.defineProperty(window, 'scrollY', {
          get: () => scrollTop,
          configurable: true
        });

        Object.defineProperty(window, 'scrollX', {
          get: () => scrollLeft,
          configurable: true
        });

        Object.defineProperty(document.documentElement, 'scrollTop', {
          get: () => scrollTop,
          configurable: true
        });

        Object.defineProperty(document.documentElement, 'scrollLeft', {
          get: () => scrollLeft,
          configurable: true
        });

        // Simulate realistic scroll events
        window.addEventListener('scroll', () => {
          const now = Date.now();
          if (now - lastScrollTime > 100) {
            scrollTop = Math.max(0, Math.min(document.body.scrollHeight - window.innerHeight, scrollTop + (Math.random() - 0.5) * 100));
            scrollLeft = Math.max(0, Math.min(document.body.scrollWidth - window.innerWidth, scrollLeft + (Math.random() - 0.5) * 50));
            lastScrollTime = now;
          }
        });
      }, this.behavioralPatterns);
    } catch (error) {
      console.error('Failed to setup scroll simulation:', error.message);
    }
  }

  async setupTimingRandomization(page) {
    try {
      await page.addInitScript(() => {
        // Randomize timing functions
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        
        window.setTimeout = function(callback, delay, ...args) {
          const randomizedDelay = delay + (Math.random() - 0.5) * 100;
          return originalSetTimeout.call(this, callback, Math.max(0, randomizedDelay), ...args);
        };

        window.setInterval = function(callback, delay, ...args) {
          const randomizedDelay = delay + (Math.random() - 0.5) * 50;
          return originalSetInterval.call(this, callback, Math.max(0, randomizedDelay), ...args);
        };

        // Randomize performance timing
        const originalNow = performance.now;
        const timeOffset = Math.random() * 1000;
        
        performance.now = function() {
          return originalNow.call(this) + timeOffset;
        };
      });
    } catch (error) {
      console.error('Failed to setup timing randomization:', error.message);
    }
  }

  async simulateHumanBehavior(page, options = {}) {
    const {
      readingTime = 30000,
      scrollCount = 3,
      mouseMovement = true,
      randomPauses = true
    } = options;

    try {
      // Simulate reading behavior
      await this.simulateReading(page, readingTime, scrollCount, randomPauses);
      
      // Simulate mouse movement
      if (mouseMovement) {
        await this.simulateMouseMovement(page);
      }
      
      // Human behavior simulation completed
    } catch (error) {
      console.error('Human behavior simulation failed:', error.message);
    }
  }

  async simulateReading(page, duration, scrollCount, randomPauses) {
    const scrollInterval = duration / (scrollCount + 1);
    
    for (let i = 0; i < scrollCount; i++) {
      await page.waitForTimeout(scrollInterval);
      
      // Random scroll behavior
      const scrollBehavior = Math.random() > 0.5 ? 'smooth' : 'auto';
      const scrollDistance = Math.floor(Math.random() * 500) + 200;
      
      await page.evaluate((distance, behavior) => {
        window.scrollBy({
          top: distance,
          behavior: behavior
        });
      }, scrollDistance, scrollBehavior);
      
      // Random pause
      if (randomPauses && Math.random() > 0.7) {
        const pauseDuration = Math.floor(Math.random() * 3000) + 1000;
        await page.waitForTimeout(pauseDuration);
      }
    }
  }

  async simulateMouseMovement(page) {
    const movements = Math.floor(Math.random() * 5) + 3;
    
    for (let i = 0; i < movements; i++) {
      const x = Math.floor(Math.random() * 1920);
      const y = Math.floor(Math.random() * 1080);
      
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
      await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);
    }
  }
}

class MouseMovementGenerator {
  generateMovement(startX, startY, endX, endY, steps = 10) {
    const movements = [];
    const dx = (endX - startX) / steps;
    const dy = (endY - startY) / steps;
    
    for (let i = 0; i <= steps; i++) {
      const x = startX + dx * i + (Math.random() - 0.5) * 10;
      const y = startY + dy * i + (Math.random() - 0.5) * 10;
      movements.push({ x: Math.round(x), y: Math.round(y) });
    }
    
    return movements;
  }
}

class ScrollSimulator {
  generateScrollPattern(type = 'normal') {
    const patterns = {
      fast: { distance: 800, delay: 100, steps: 2 },
      normal: { distance: 400, delay: 200, steps: 4 },
      slow: { distance: 200, delay: 400, steps: 8 },
      reading: { distance: 100, delay: 1000, steps: 1 }
    };
    
    return patterns[type] || patterns.normal;
  }
}

export default StealthHelper;