import { Actor } from 'apify';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ProxyAgent } from 'proxy-agent';
import { getRandomUserAgent } from '../utils/userAgentManager.js';
import { MEDIUM_CONSTANTS } from '../config/constants.js';

export class ProxyManager {
  constructor(options = {}) {
    this.proxyList = options.proxyList || [];
    this.currentIndex = 0;
    this.failedProxies = new Set();
    this.rotationInterval = options.rotationInterval || MEDIUM_CONSTANTS.PROXY_ROTATION_INTERVAL;
    this.useRotatingProxies = options.useRotatingProxies !== false;
    this.stats = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      proxyChanges: 0
    };
  }

  async initialize() {
    if (this.useRotatingProxies) {
      await this.loadApifyProxies();
    }
    
    if (this.proxyList.length === 0 && this.useRotatingProxies) {
      console.warn('No proxies available, will use direct connection');
      this.useRotatingProxies = false;
    }
  }

  async loadApifyProxies() {
    try {
      // Try to get proxies from Apify proxy configuration
      const proxyConfiguration = await Actor.createProxyConfiguration();
      if (proxyConfiguration) {
        const proxyUrl = await proxyConfiguration.newUrl();
        if (proxyUrl) {
          this.proxyList.push(proxyUrl);
        }
      }
    } catch (error) {
      console.warn('Failed to load Apify proxies:', error.message);
    }
  }

  getCurrentProxy() {
    if (!this.useRotatingProxies || this.proxyList.length === 0) {
      return null;
    }
    
    return this.proxyList[this.currentIndex];
  }

  getNextProxy() {
    if (!this.useRotatingProxies || this.proxyList.length === 0) {
      return null;
    }

    // Find next working proxy
    let attempts = 0;
    let proxy = null;
    
    while (attempts < this.proxyList.length) {
      this.currentIndex = (this.currentIndex + 1) % this.proxyList.length;
      proxy = this.proxyList[this.currentIndex];
      
      if (!this.failedProxies.has(proxy)) {
        break;
      }
      attempts++;
    }

    if (proxy && this.failedProxies.has(proxy)) {
      // All proxies failed, reset failed list
      this.failedProxies.clear();
      console.warn('All proxies marked as failed, resetting failed proxy list');
    }

    this.stats.proxyChanges++;
    return proxy;
  }

  markProxyFailed(proxy) {
    if (proxy) {
      this.failedProxies.add(proxy);
      this.stats.failedRequests++;
      console.warn(`Proxy marked as failed: ${proxy}`);
    }
  }

  markProxySuccess(proxy) {
    this.stats.successfulRequests++;
    // Remove from failed list if it was previously marked
    if (proxy && this.failedProxies.has(proxy)) {
      this.failedProxies.delete(proxy);
    }
  }

  createProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;

    try {
      if (proxyUrl.startsWith('socks')) {
        return new SocksProxyAgent(proxyUrl);
      } else if (proxyUrl.startsWith('http')) {
        return new HttpsProxyAgent(proxyUrl);
      } else {
        return new ProxyAgent(proxyUrl);
      }
    } catch (error) {
      console.error('Failed to create proxy agent:', error.message);
      return null;
    }
  }

  getStats() {
    return {
      ...this.stats,
      totalRequests: this.stats.successfulRequests + this.stats.failedRequests,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) 
        : 0,
      availableProxies: this.proxyList.length - this.failedProxies.size,
      totalProxies: this.proxyList.length
    };
  }

  shouldRotateProxy(requestCount) {
    return this.useRotatingProxies && requestCount > 0 && requestCount % this.rotationInterval === 0;
  }
}

export default ProxyManager;