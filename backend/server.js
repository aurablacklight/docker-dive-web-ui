const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import routes
const searchRoutes = require('./routes/search');
const inspectRoutes = require('./routes/inspect');
const imagesRoutes = require('./routes/images');

// Import middleware
const corsMiddleware = require('./middleware/cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://dive.docker-senpai.dev", "https://docker-senpai.dev"]
      : "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // much higher limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

// Disabled inspection rate limiting for development
if (process.env.NODE_ENV === 'production') {
  const inspectLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 inspections per hour
    message: {
      error: 'Too many inspection requests, please try again later.'
    }
  });
  app.use('/api/inspect', inspectLimiter);
}

// CORS middleware - apply before all routes
app.use(corsMiddleware);

// Additional CORS headers for development and production
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
} else {
  // Production CORS headers for Cloudflare domain
  app.use((req, res, next) => {
    const allowedOrigins = [
      'https://dive.docker-senpai.dev',
      'https://docker-senpai.dev'
    ];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Store WebSocket connections for real-time updates
const inspectionSockets = new Map();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('WebSocket client connected:', socket.id);

  socket.on('subscribe', (data) => {
    const { imageName } = data;
    if (imageName) {
      inspectionSockets.set(imageName, socket);
      console.log(`Subscribed to inspection updates for: ${imageName}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected:', socket.id);
    // Remove socket from all subscriptions
    for (const [imageName, s] of inspectionSockets.entries()) {
      if (s.id === socket.id) {
        inspectionSockets.delete(imageName);
      }
    }
  });
});

// Make io available to routes
app.set('io', io);
app.set('inspectionSockets', inspectionSockets);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/search', searchRoutes);
app.use('/api/inspect', inspectRoutes);
app.use('/api/images', imagesRoutes);

// Serve static files from the React app build (in production)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'public');
  
  app.use(express.static(buildPath));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend build not found' });
    }
  });
} else {
  // Development mode - just return API info for root
  app.get('/', (req, res) => {
    res.json({
      message: 'Dive Inspector API Server',
      version: '1.0.0',
      environment: 'development',
      endpoints: {
        health: '/api/health',
        search: '/api/search?q=<query>',
        popular: '/api/search/popular',
        inspect: '/api/inspect/<imageName>',
        images: '/api/images/local',
        pull: '/api/images/pull',
        websocket: '/ws/inspect'
      }
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Dive Inspector API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('API Documentation:');
    console.log(`- Search: http://localhost:${PORT}/api/search?q=nginx`);
    console.log(`- Popular: http://localhost:${PORT}/api/search/popular`);
    console.log(`- Inspect: http://localhost:${PORT}/api/inspect/nginx`);
    console.log(`- Images: http://localhost:${PORT}/api/images/local`);
  }
});

module.exports = { app, server, io };
