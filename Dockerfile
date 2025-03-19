# Use Node.js base image with Ubuntu
FROM node:20-bullseye

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies and Playwright
RUN apt-get update && \
    apt-get install -y \
    libreoffice \
    chromium \
    && rm -rf /var/lib/apt/lists/* \
    && npm install \
    && npx playwright install chromium \
    && npx playwright install-deps chromium

# Copy the rest of the actor files
COPY . ./

# Set the environment variables
ENV APIFY_DISABLE_OUTDATED_WARNING=1
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/src/app/chrome

# Define the command to run the actor
CMD ["npm", "start"] 