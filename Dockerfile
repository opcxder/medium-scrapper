# Use Node.js LTS version
FROM node:20-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers
RUN npx playwright install chromium

# Copy source code
COPY . .

# Create directories for cache and output
RUN mkdir -p /app/cache /app/output && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Set environment variables
ENV NODE_ENV=production \
    OUTPUT_DIR=/app/output \
    CACHE_DIR=/app/cache

# Run the scraper
CMD ["node", "src/main.js"] 