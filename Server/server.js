// Server/server.js - Main server entry point for voice loop
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./lib/logger');
const realtimeVoiceService = require('./services/realtime-voice');

// Import routes
const realtimeRoutes = require('./routes/realtime');
const voiceRoutes = require('./routes/voice');

// Create Express app
const app = express();
const server = http.createServer(app);

// Environment configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for WebSocket compatibility
  crossOriginEmbedderPolicy: false // Disable for audio API compatibility
}));

// CORS configuration for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Development - allow localhost
    if (isDevelopment) {
      const developmentOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ];
      
      if (developmentOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    
    // Production - check environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : [];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // Higher limit for development
  message: {
    error: 'Rate limit exceeded',
    retry_after: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.raw({ type: 'application/sdp', limit: '1mb' }));

// Request logging
app.use(logger.middleware());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      voice: !!process.env.OPENAI_API_KEY,
      realtime: !!process.env.OPENAI_API_KEY
    }
  });
});

// API routes
app.use('/api/realtime', realtimeRoutes);
app.use('/api/voice', voiceRoutes);

// WebSocket endpoint for direct voice connections (legacy support)
app.post('/api/realtime/direct', async (req, res) => {
  try {
    logger.info('Direct realtime connection request', {
      contentType: req.headers['content-type'],
      origin: req.headers.origin
    });
    
    if (req.headers['content-type'] === 'application/sdp') {
      // Handle SDP offer for WebRTC-style connections
      const sdpOffer = req.body.toString();
      logger.debug('Received SDP offer', { length: sdpOffer.length });
      
      // For now, return an error since we're using WebSocket approach
      return res.status(501).json({
        error: 'webrtc_not_implemented',
        message: 'WebRTC not implemented, use WebSocket connection',
        websocket_url: '/voice'
      });
    }
    
    res.status(400).json({
      error: 'invalid_request',
      message: 'Expected SDP offer with application/sdp content type'
    });
    
  } catch (error) {
    logger.error('Direct realtime connection error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to process realtime connection'
    });
  }
});

// Catch-all for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'endpoint_not_found',
    message: `API endpoint ${req.originalUrl} not found`,
    available_endpoints: [
      'GET /health',
      'POST /api/realtime/session',
      'GET /api/realtime/models',
      'GET /api/voice/health',
      'GET /api/voice/voices',
      'POST /api/voice/tts',
      'WebSocket /voice'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  // CORS error
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'cors_error',
      message: 'Origin not allowed',
      origin: req.headers.origin
    });
  }
  
  // Rate limit error
  if (error.status === 429) {
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests',
      retry_after: error.headers['retry-after']
    });
  }
  
  res.status(500).json({
    error: 'internal_server_error',
    message: isDevelopment ? error.message : 'Internal server error',
    stack: isDevelopment ? error.stack : undefined
  });
});

// Initialize WebSocket server for voice connections
const voiceWss = realtimeVoiceService.initWebSocketServer(server);
logger.info('Voice WebSocket server initialized', { path: '/voice' });

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Voice Loop Server running`, {
    port: PORT,
    environment: NODE_ENV,
    pid: process.pid,
    node_version: process.version
  });
  
  logger.info('📋 Server configuration:', {
    openai_configured: !!process.env.OPENAI_API_KEY,
    elevenlabs_configured: !!process.env.ELEVENLABS_API_KEY,
    cors_origins: isDevelopment ? 'development_mode' : process.env.ALLOWED_ORIGINS,
    websocket_path: '/voice',
    rate_limit: isDevelopment ? '1000/15min' : '100/15min'
  });
  
  // Log available endpoints
  logger.info('🔌 Available endpoints:', {
    health: 'GET /health',
    realtime_session: 'POST /api/realtime/session',
    voice_health: 'GET /api/voice/health',
    voice_tts: 'POST /api/voice/tts',
    websocket: 'WS /voice'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, starting graceful shutdown');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close WebSocket connections
    realtimeVoiceService.closeAllConnections();
    
    // Close logger
    logger.shutdown();
    
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, starting graceful shutdown');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close WebSocket connections
    realtimeVoiceService.closeAllConnections();
    
    // Close logger
    logger.shutdown();
    
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at promise:', { reason, promise });
  process.exit(1);
});

module.exports = { app, server };