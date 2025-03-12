# Use Windows-based Node.js image
FROM mcr.microsoft.com/windows/nanoserver:ltsc2022

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Playwright Chromium
RUN npx playwright install chromium

# Copy project files
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH="C:\\ms-playwright"

# Command to run the scraper
CMD ["node", "src/index.js"]
