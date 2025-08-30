FROM node:18-alpine

# Install system dependencies (cached layer - rarely changes)
RUN apk add --no-cache curl docker-cli

# Install dive binary (cached layer - rarely changes)
RUN curl -OL https://github.com/wagoodman/dive/releases/download/v0.13.1/dive_0.13.1_linux_amd64.tar.gz && \
    tar -xzf dive_0.13.1_linux_amd64.tar.gz && \
    mv dive /usr/local/bin/ && \
    rm dive_0.13.1_linux_amd64.tar.gz && \
    chmod +x /usr/local/bin/dive

# Set working directory
WORKDIR /app

# Copy package files first (separate layer for dependency caching)
COPY package*.json ./

# Install dependencies (cached layer - only rebuilds when package*.json changes)
RUN npm install --only=production

# Copy application code (this layer rebuilds when source changes)
COPY . .

# Create temp directory for dive analysis
RUN mkdir -p temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
