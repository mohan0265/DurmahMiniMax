// Server/index.js - Production-Ready Durmah Backend
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./lib/logger');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Validate critical environment variables
function validateEnvironment() {
  const required = [
    'OPENAI_API_KEY',
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE',
    'JWT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please check your .env file or hosting platform environment variables');
    process.exit(1);
  }
}

validateEnvironment();

const app = express();
const server = http.createServer(app);

// Trust reverse proxies (Render/Railway/Fly/Vercel)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow WebRTC
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "https:"],
      mediaSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// CORS Configuration
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 
  'http://localhost:3000,http://localhost:5173,https://durmah-legal-buddy.netlify.app'
).split(',').map(origin => origin.trim());

const netlifyPreviewRegexes = [
  /^https:\/\/.*--durmah-legal-buddy\.netlify\.app$/,
  /^https:\/\/deploy-preview-.*--durmah-legal-buddy\.netlify\.app$/,
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Check explicit allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check Netlify preview deployments
    if (netlifyPreviewRegexes.some(regex => regex.test(origin))) {
      return callback(null, true);
    }
    
    // Development origins
    if (process.env.NODE_ENV === 'development') {
      const devOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174'
      ];
      if (devOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-client-info', 
    'x-session-id',
    'x-user-id'
  ],
  optionsSuccessStatus: 200
};

// Body parsers (before routes)
app.use(express.json({ 
  limit: '10mb', 
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// ============================
// HEALTH CHECK ENDPOINTS
// ============================

// Primary health check for load balancers
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    message: 'Durmah Legal Buddy is running! 🦅',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      supabase: !!process.env.SUPABASE_URL,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY || 'fallback-available'
    }
  };
  
  res.status(200).json(health);
});

// Render-specific health check
app.get('/api/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Detailed system status (for monitoring)
app.get('/api/status', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
    },
    environment: {
      node_version: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development'
    },
    features: {
      voice_realtime: !!process.env.OPENAI_API_KEY,
      text_to_speech: !!process.env.ELEVENLABS_API_KEY || 'browser-fallback',
      memory_system: !!process.env.SUPABASE_SERVICE_ROLE,
      crisis_detection: process.env.FEATURE_CRISIS_DETECTION !== 'false',
      academic_integrity: process.env.FEATURE_ACADEMIC_INTEGRITY !== 'false'
    }
  });
});

// ============================
// API ROUTES WITH CORS
// ============================

// Apply CORS to all API routes
app.use('/api', cors(corsOptions));

// Import and initialize services
const MemoryService = require('./services/memory-service');
const VoiceService = require('./services/voice-service');
const IntegrityService = require('./services/integrity-service');

// Initialize services
MemoryService.init();
VoiceService.init();
IntegrityService.init();

// Route imports with error handling
let routesLoaded = false;
try {
  const authRoutes = require('./routes/auth');
  const chatRoutes = require('./routes/chat');
  const studyRoutes = require('./routes/study');
  const wellbeingRoutes = require('./routes/wellbeing');
  const realtimeRoutes = require('./routes/realtime');
  const voiceRoutes = require('./routes/voice');

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/study', studyRoutes);
  app.use('/api/wellbeing', wellbeingRoutes);
  app.use('/api/realtime', realtimeRoutes);
  app.use('/api/voice', voiceRoutes);
  
  routesLoaded = true;
  logger.info('All API routes loaded successfully');
} catch (error) {
  logger.error('Failed to load routes:', error);
  routesLoaded = false;
}

// Routes status endpoint
app.get('/api/routes-status', (req, res) => {
  res.json({
    status: routesLoaded ? 'loaded' : 'error',
    timestamp: new Date().toISOString(),
    available_endpoints: routesLoaded ? [
      '/api/auth/*',
      '/api/chat/*', 
      '/api/study/*',
      '/api/wellbeing/*',
      '/api/realtime/*',
      '/api/voice/*'
    ] : []
  });
});

// ============================
// ERROR HANDLING & 404
// ============================

// API 404 handler
app.use('/api/*', (req, res) => {
  logger.warn(`404 API endpoint not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Endpoint not found', 
    message: `API endpoint ${req.path} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Global error handler:', error);
  
  // CORS errors
  if (error.message && error.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Policy Violation',
      message: 'This origin is not allowed to access this resource',
      timestamp: new Date().toISOString()
    });
  }
  
  // Rate limiting errors
  if (error.status === 429) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests, please try again later',
      retryAfter: error.retryAfter || 15
    });
  }
  
  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Failed',
      message: error.message,
      details: error.details || null
    });
  }
  
  // Default error response
  const status = error.status || error.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : 'Request Failed',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack }),
    timestamp: new Date().toISOString()
  });
});

// ============================
// WEBSOCKET VOICE SERVICE
// ============================

// Initialize enhanced realtime voice service
const RealtimeVoiceService = require('./services/realtime-voice-enhanced');
const voiceService = new RealtimeVoiceService();
voiceService.initWebSocketServer(server);

// ============================
// SERVER STARTUP
// ============================

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Required for Render, Railway, Fly.io

server.listen(PORT, HOST, () => {
  const environment = process.env.NODE_ENV || 'development';
  const externalUrl = 
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : null) ||
    `http://localhost:${PORT}`;
  
  logger.info('Server Configuration:', {
    port: PORT,
    host: HOST,
    environment,
    externalUrl,
    cors: allowedOrigins,
    features: {
      voice: !!process.env.OPENAI_API_KEY,
      tts: !!process.env.ELEVENLABS_API_KEY || 'browser-fallback',
      memory: !!process.env.SUPABASE_SERVICE_ROLE
    }
  });

  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║        🦅 DURMAH - LEGAL EAGLE BUDDY 🦅        ║
║                                                  ║
║        Production Voice Tutoring System         ║
║                                                  ║
║        Server: ${externalUrl.padEnd(32)} ║
║        WebSocket: ${(externalUrl + '/voice').padEnd(28)} ║
║        Environment: ${environment.padEnd(26)} ║
║                                                  ║
║        Built with love for Durham Law Students   ║
║                                                  ║
╚══════════════════════════════════════════════════╝`);

  // Log startup diagnostics
  const diagnostics = {
    timestamp: new Date().toISOString(),
    node_version: process.version,
    memory_usage: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heap_used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    },
    environment_check: {
      openai_key: !!process.env.OPENAI_API_KEY,
      supabase_url: !!process.env.SUPABASE_URL,
      supabase_service: !!process.env.SUPABASE_SERVICE_ROLE,
      elevenlabs_key: !!process.env.ELEVENLABS_API_KEY
    }
  };
  
  logger.info('Startup diagnostics:', diagnostics);
});

// ============================
// GRACEFUL SHUTDOWN
// ============================

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Set a timeout for force shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Force shutdown due to timeout');
    process.exit(1);
  }, 30000); // 30 seconds
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close voice service connections
      if (voiceService) {
        await voiceService.closeAllConnections();
        logger.info('Voice service connections closed');
      }
      
      // Close other services
      if (MemoryService && MemoryService.close) {
        await MemoryService.close();
        logger.info('Memory service closed');
      }
      
      logger.info('Graceful shutdown completed');
      clearTimeout(forceShutdownTimeout);
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      clearTimeout(forceShutdownTimeout);
      process.exit(1);
    }
  });
  
  // Stop accepting new connections
  server.closeAllConnections?.();
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
