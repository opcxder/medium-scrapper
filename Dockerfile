FROM node:20-slim

# Install dependencies required for Playwright
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
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
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Skip Playwright browser installation (Apify already has it)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p data/output data/cache

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/pw-browsers

# Run the scraper
CMD ["node", "src/index.js"]
