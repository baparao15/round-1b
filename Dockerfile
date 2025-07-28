# --- UPDATED: Using Node.js 20 to support modern JavaScript features ---
FROM --platform=linux/amd64 node:20-slim

# Set the application's working directory
WORKDIR /app

# Set environment variables for the Transformers.js library cache
ENV TRANSFORMERS_CACHE=/app/models

# Copy package management files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the model downloader script and run it
# This crucial step downloads the model during the build, ensuring offline capability.
COPY download_model.js .
RUN node download_model.js

# Switch to offline mode for runtime (model is now cached)
ENV TRANSFORMERS_OFFLINE=1

# Copy the application source code
COPY src/ ./src/

# Define the command to run the application
CMD ["node", "src/main.js"]