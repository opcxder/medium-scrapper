import winston from 'winston';
import fs from 'fs-extra';
import path from 'path';
import { Actor } from 'apify';

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs');
await fs.ensureDir(logsDir);

// Configure winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'medium-scraper' },
  transports: [
    // File transport for all logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for errors only
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ]
});

export class ScrapingLogger {
  constructor(context = {}) {
    this.context = context;
    this.startTime = Date.now();
    this.stats = {
      articlesScraped: 0,
      errors: 0,
      warnings: 0,
      retries: 0,
      paywallHits: 0,
      proxyChanges: 0,
      sessionDuration: 0
    };
  }

  log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
      stats: this.stats
    };

    logger.log(level, message, logEntry);
    
    // Also log to Apify dataset if available
    try {
      Actor.pushData(logEntry);
    } catch (error) {
      // Ignore if Actor is not available
    }
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.stats.warnings++;
    this.log('warn', message, meta);
  }

  error(message, error = null, meta = {}) {
    this.stats.errors++;
    const errorMeta = {
      ...meta,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : null
    };
    this.log('error', message, errorMeta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  // Specific logging methods for scraping events
  logScrapingStart(authorUrl, options = {}) {
    this.info('Medium scraping started', {
      authorUrl,
      options,
      event: 'scraping_start'
    });
  }

  logAuthorScraped(authorData) {
    this.stats.articlesScraped = authorData.articles?.length || 0;
    this.info('Author scraped successfully', {
      authorName: authorData.name,
      articlesCount: authorData.articles?.length || 0,
      followers: authorData.followers,
      event: 'author_scraped'
    });
  }

  logArticleScraped(articleData) {
    this.stats.articlesScraped++;
    this.info('Article scraped', {
      title: articleData.title,
      url: articleData.url,
      readingTime: articleData.readingTime,
      claps: articleData.claps,
      isPremium: articleData.isPremium,
      event: 'article_scraped'
    });
  }

  logPaywallDetected(articleUrl) {
    this.stats.paywallHits++;
    this.warn('Paywall detected', {
      articleUrl,
      event: 'paywall_detected'
    });
  }

  logRetryAttempt(url, attempt, maxAttempts) {
    this.stats.retries++;
    this.warn('Retry attempt', {
      url,
      attempt,
      maxAttempts,
      event: 'retry_attempt'
    });
  }

  logProxyChange(proxyUrl) {
    this.stats.proxyChanges++;
    this.info('Proxy changed', {
      proxyUrl,
      event: 'proxy_changed'
    });
  }

  logError(error, context = {}) {
    this.error('Scraping error', error, {
      ...context,
      event: 'scraping_error'
    });
  }

  logScrapingComplete(finalData) {
    this.stats.sessionDuration = Date.now() - this.startTime;
    this.info('Scraping completed', {
      totalArticles: finalData.length,
      sessionDuration: this.stats.sessionDuration,
      finalStats: this.stats,
      event: 'scraping_complete'
    });
  }

  getStats() {
    return {
      ...this.stats,
      sessionDuration: Date.now() - this.startTime,
      successRate: this.stats.articlesScraped > 0 
        ? ((this.stats.articlesScraped - this.stats.errors) / this.stats.articlesScraped * 100).toFixed(2)
        : 0
    };
  }

  exportLogs(format = 'json') {
    const stats = this.getStats();
    const logData = {
      sessionInfo: {
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: stats.sessionDuration
      },
      statistics: stats,
      context: this.context
    };

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(logData, null, 2);
      case 'csv':
        return this.convertToCSV(logData);
      default:
        return logData;
    }
  }

  convertToCSV(data) {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Session Duration', data.statistics.sessionDuration],
      ['Articles Scraped', data.statistics.articlesScraped],
      ['Errors', data.statistics.errors],
      ['Warnings', data.statistics.warnings],
      ['Retries', data.statistics.retries],
      ['Paywall Hits', data.statistics.paywallHits],
      ['Proxy Changes', data.statistics.proxyChanges],
      ['Success Rate', data.statistics.successRate]
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

// Export logger instances
export function createLogger(context = {}) {
  return new ScrapingLogger(context);
}

export default {
  logger,
  ScrapingLogger,
  createLogger
};