// Server/lib/logger.js - Production-grade logging
const winston = require('winston');
const path = require('path');

// Custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: customFormat,
  defaultMeta: { service: 'durmah-backend' },
  transports: [
    // Console logging for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// In production, also log to files if writable directory exists
if (process.env.NODE_ENV === 'production') {
  try {
    // Error logs
    logger.add(new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));
    
    // Combined logs
    logger.add(new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));
  } catch (error) {
    // If can't write to files, continue with console only
    logger.warn('Could not set up file logging:', error.message);
  }
}

// Add request logging method
logger.request = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  if (next) next();
};

// Add voice logging methods
logger.voice = {
  connection: (connectionId, event, data = {}) => {
    logger.info(`[Voice:${connectionId}] ${event}`, data);
  },
  error: (connectionId, error, context = {}) => {
    logger.error(`[Voice:${connectionId}] Error: ${error.message}`, { 
      stack: error.stack, 
      ...context 
    });
  },
  session: (sessionId, event, data = {}) => {
    logger.info(`[Session:${sessionId}] ${event}`, data);
  }
};

// Add memory logging methods
logger.memory = {
  save: (userId, type, data = {}) => {
    logger.debug(`[Memory:${userId}] Saved ${type}`, data);
  },
  retrieve: (userId, type, data = {}) => {
    logger.debug(`[Memory:${userId}] Retrieved ${type}`, data);
  },
  error: (userId, operation, error) => {
    logger.error(`[Memory:${userId}] ${operation} failed: ${error.message}`, {
      stack: error.stack
    });
  }
};

// Add integrity logging methods
logger.integrity = {
  flag: (userId, reason, severity, data = {}) => {
    logger.warn(`[Integrity:${userId}] Flagged: ${reason} (${severity})`, data);
  },
  violation: (userId, type, content) => {
    logger.error(`[Integrity:${userId}] Violation detected: ${type}`, {
      content: content.substring(0, 100) + '...'
    });
  }
};

// Handle uncaught exceptions and rejections
logger.exceptions.handle(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    )
  })
);

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise
  });
});

module.exports = logger;