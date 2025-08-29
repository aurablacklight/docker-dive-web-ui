FROM node:18-alpine

# Install dive binary
RUN apk add --no-cache curl && \
    curl -OL https://github.com/wagoodman/dive/releases/download/v0.13.1/dive_0.13.1_linux_amd64.tar.gz && \
    tar -xzf dive_0.13.1_linux_amd64.tar.gz && \
    mv dive /usr/local/bin/ && \
    rm dive_0.13.1_linux_amd64.tar.gz && \
    chmod +x /usr/local/bin/dive

# Install Docker CLI
RUN apk add --no-cache docker-cli

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for testing)
RUN npm ci

# Copy application code
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
