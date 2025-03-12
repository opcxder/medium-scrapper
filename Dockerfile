# Use Node.js base image
FROM mcr.microsoft.com/playwright:v1.41.0-focal

# Set working directory
WORKDIR /usr/src/app

# Copy package files and schema
COPY package*.json input_schema.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Create necessary directories
RUN mkdir -p output cache

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

# Set permissions
RUN chown -R node:node /usr/src/app
USER node

# Define the command to run the actor
CMD ["npm", "start"] 