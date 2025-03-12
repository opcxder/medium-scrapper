import https from 'https';
import CONFIG from '../config/config.js';

class ProxyService {
    constructor() {
        this.proxyUrls = [];
        this.currentIndex = 0;
        this.healthyProxies = new Set();
    }

    /**
     * Initialize the proxy service with a list of proxy URLs
     * @param {string[]} proxyUrls - List of proxy URLs
     */
    async init(proxyUrls) {
        this.proxyUrls = proxyUrls;
        await this.checkProxyHealth();
    }

    /**
     * Check health of all proxies
     */
    async checkProxyHealth() {
        const healthChecks = this.proxyUrls.map(proxy => this.isProxyHealthy(proxy));
        const results = await Promise.allSettled(healthChecks);

        this.healthyProxies.clear();
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                this.healthyProxies.add(this.proxyUrls[index]);
            }
        });

        if (this.healthyProxies.size === 0) {
            console.warn('No healthy proxies found. Proceeding without proxy.');
        }
    }

    /**
     * Check if a proxy is responsive
     * @param {string} proxyUrl - The proxy URL to check
     * @returns {Promise<boolean>} Whether the proxy is healthy
     */
    async isProxyHealthy(proxyUrl) {
        return new Promise((resolve) => {
            const timeout = 5000; // 5 seconds timeout
            const testUrl = 'https://medium.com';

            const [host, port] = proxyUrl.split(':');
            const options = {
                host,
                port: parseInt(port),
                method: 'HEAD',
                path: testUrl,
                timeout,
            };

            const req = https.request(options, (res) => {
                resolve(res.statusCode >= 200 && res.statusCode < 300);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    /**
     * Get the next healthy proxy URL
     * @returns {string|null} The next proxy URL or null if none available
     */
    getNextProxy() {
        if (!CONFIG.proxy.useProxy || this.healthyProxies.size === 0) {
            return null;
        }

        const healthyProxies = Array.from(this.healthyProxies);
        this.currentIndex = (this.currentIndex + 1) % healthyProxies.length;
        return healthyProxies[this.currentIndex];
    }

    /**
     * Mark a proxy as unhealthy
     * @param {string} proxyUrl - The proxy URL to mark as unhealthy
     */
    markProxyUnhealthy(proxyUrl) {
        this.healthyProxies.delete(proxyUrl);
        if (this.healthyProxies.size === 0) {
            console.warn('No healthy proxies remaining. Will retry health checks.');
            setTimeout(() => this.checkProxyHealth(), 60000); // Retry after 1 minute
        }
    }

    /**
     * Get proxy options for Playwright
     * @returns {Object|null} Proxy options for Playwright or null if proxy is disabled
     */
    getProxyOptions() {
        const proxy = this.getNextProxy();
        if (!proxy) return null;

        const [host, port] = proxy.split(':');
        return {
            server: `http://${host}:${port}`,
            bypass: 'localhost,127.0.0.1'
        };
    }
}

// Create and initialize proxy service
const proxyService = new ProxyService();
if (CONFIG.proxy.useProxy) {
    await proxyService.init(CONFIG.proxy.proxyUrls);
}

export default proxyService; 