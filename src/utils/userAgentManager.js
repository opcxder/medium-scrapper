import UserAgents from 'user-agents';
import { MEDIUM_CONSTANTS } from '../config/constants.js';

class UserAgentManager {
  constructor() {
    this.userAgents = new Map();
    this.currentIndex = 0;
    this.rotationInterval = MEDIUM_CONSTANTS.USER_AGENT_ROTATION_INTERVAL;
    this.initializeUserAgents();
  }

  initializeUserAgents() {
    // Generate diverse set of realistic user agents
    const userAgentOptions = [
      { deviceCategory: 'desktop' },
      { deviceCategory: 'mobile' },
      { deviceCategory: 'tablet' },
      { platform: 'Win32' },
      { platform: 'MacIntel' },
      { platform: 'Linux x86_64' },
      { vendor: 'Google Inc.' },
      { vendor: 'Apple Computer, Inc.' }
    ];

    userAgentOptions.forEach((options, index) => {
      try {
        const userAgent = new UserAgents(options);
        this.userAgents.set(index, userAgent);
      } catch (error) {
        console.warn('Failed to generate user agent:', error.message);
      }
    });

    // Add some specific browser versions
    const specificUserAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];

    specificUserAgents.forEach((ua, index) => {
      this.userAgents.set(this.userAgents.size + index, { random: () => ({ userAgent: ua }) });
    });
  }

  getRandomUserAgent() {
    if (this.userAgents.size === 0) {
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    const keys = Array.from(this.userAgents.keys());
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const userAgent = this.userAgents.get(randomKey);
    
    return userAgent.random ? userAgent.random().userAgent : userAgent.userAgent || userAgent;
  }

  getNextUserAgent() {
    if (this.userAgents.size === 0) {
      return this.getRandomUserAgent();
    }

    const keys = Array.from(this.userAgents.keys());
    this.currentIndex = (this.currentIndex + 1) % keys.length;
    const userAgent = this.userAgents.get(keys[this.currentIndex]);
    
    return userAgent.random ? userAgent.random().userAgent : userAgent.userAgent || userAgent;
  }

  shouldRotateUserAgent(requestCount) {
    return requestCount > 0 && requestCount % this.rotationInterval === 0;
  }

  getStats() {
    return {
      totalUserAgents: this.userAgents.size,
      currentIndex: this.currentIndex,
      rotationInterval: this.rotationInterval
    };
  }
}

// Create singleton instance
const userAgentManager = new UserAgentManager();

export function getRandomUserAgent() {
  return userAgentManager.getRandomUserAgent();
}

export function getNextUserAgent() {
  return userAgentManager.getNextUserAgent();
}

export function shouldRotateUserAgent(requestCount) {
  return userAgentManager.shouldRotateUserAgent(requestCount);
}

export function getUserAgentStats() {
  return userAgentManager.getStats();
}

export default {
  getRandomUserAgent,
  getNextUserAgent,
  shouldRotateUserAgent,
  getUserAgentStats,
  UserAgentManager
};