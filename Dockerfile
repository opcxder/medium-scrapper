# Start with the Apify base image that includes Node.js
FROM apify/actor-node:18

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package.json ./

# Install dependencies including Playwright
RUN npm install && \
    npx playwright install chromium && \
    npx playwright install-deps chromium

# Install additional dependencies for handling different file formats
RUN apt-get update && apt-get install -y \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# Copy the rest of the actor files
COPY . ./

# Run tests and check code quality if needed
# RUN npm test

# Set the environment variables
ENV APIFY_DISABLE_OUTDATED_WARNING=1
ENV NODE_ENV=production

# Define the command to run the actor
CMD ["npm", "start"] 