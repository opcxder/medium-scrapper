# Use Apify's Node.js Playwright Chrome image
FROM apify/actor-node-playwright-chrome:latest

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm --quiet set progress=false \
 && npm install --only=prod --no-optional \
 && echo "Installed NPM packages:" \
 && (npm list --only=prod --no-optional --all || true) \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version

# Copy the rest of the application files
COPY . ./

# Set the environment variables
ENV APIFY_DISABLE_OUTDATED_WARNING=1
ENV NODE_ENV=production

# Define the command to run the actor
CMD ["npm", "start"] 