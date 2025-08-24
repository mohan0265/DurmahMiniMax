// Server/lib/logger.js - Enhanced logging system for voice loop
const fs = require('fs');
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');

// Ensure log directory exists
if (LOG_TO_FILE && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const COLORS = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[90m', // gray
  reset: '\x1b[0m'
};

class Logger {
  constructor() {
    this.level = LEVELS[LOG_LEVEL] || LEVELS.info;
    this.logFile = LOG_TO_FILE ? path.join(LOG_DIR, `durmah-${new Date().toISOString().split('T')[0]}.log`) : null;
    
    // Specialized loggers
    this.voice = new VoiceLogger();
    this.integrity = new IntegrityLogger();
    this.memory = new MemoryLogger();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  log(level, message, meta = {}) {
    if (LEVELS[level] <= this.level) {
      const formattedMessage = this.formatMessage(level, message, meta);
      
      // Console output with colors
      const colorCode = COLORS[level] || COLORS.reset;
      console.log(`${colorCode}${formattedMessage}${COLORS.reset}`);
      
      // File output
      if (this.logFile) {
        try {
          fs.appendFileSync(this.logFile, formattedMessage + '\n');
        } catch (error) {
          console.error('Failed to write to log file:', error);
        }
      }
    }
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  // Express middleware for request logging
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const level = status >= 400 ? 'warn' : 'info';
        
        this.log(level, `${req.method} ${req.originalUrl}`, {
          status,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      });
      
      next();
    };
  }
}

// Specialized logger for voice operations
class VoiceLogger {
  constructor() {
    this.sessions = new Map();
  }

  session(sessionId, event, data = {}) {
    const message = `Voice session ${event}: ${sessionId}`;
    logger.info(message, { sessionId, event, ...data });
    
    // Track session state
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        created: new Date(),
        events: []
      });
    }
    
    this.sessions.get(sessionId).events.push({
      event,
      timestamp: new Date(),
      data
    });
  }

  connection(connectionId, event, data = {}) {
    const message = `Voice connection ${event}: ${connectionId}`;
    logger.info(message, { connectionId, event, ...data });
  }

  audio(sessionId, event, data = {}) {
    const message = `Audio ${event}: ${sessionId}`;
    logger.debug(message, { sessionId, event, ...data });
  }

  getSessionStats(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }
}

// Specialized logger for integrity checks
class IntegrityLogger {
  flag(userId, reason, severity = 'medium', data = {}) {
    const message = `Integrity flag: ${reason} for user ${userId || 'anonymous'}`;
    const level = severity === 'high' ? 'warn' : 'info';
    
    logger.log(level, message, {
      userId,
      reason,
      severity,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  citation(userId, type, data = {}) {
    const message = `Citation guidance: ${type} for user ${userId || 'anonymous'}`;
    logger.info(message, { userId, type, ...data });
  }

  assistance(userId, level, context, data = {}) {
    const message = `Assistance level ${level} in ${context} for user ${userId || 'anonymous'}`;
    logger.info(message, { userId, level, context, ...data });
  }
}

// Specialized logger for memory operations
class MemoryLogger {
  store(userId, type, data = {}) {
    const message = `Memory store: ${type} for user ${userId || 'anonymous'}`;
    logger.debug(message, { userId, type, ...data });
  }

  retrieve(userId, query, results, data = {}) {
    const message = `Memory retrieve: "${query}" returned ${results} results for user ${userId || 'anonymous'}`;
    logger.debug(message, { userId, query, results, ...data });
  }

  update(userId, type, data = {}) {
    const message = `Memory update: ${type} for user ${userId || 'anonymous'}`;
    logger.debug(message, { userId, type, ...data });
  }
}

// Create singleton logger instance
const logger = new Logger();

// Performance monitoring
const performanceMonitor = {
  startTimer: (label) => {
    const start = process.hrtime.bigint();
    return {
      end: () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1000000;
        logger.debug(`Performance: ${label}`, { duration: `${durationMs.toFixed(2)}ms` });
        return durationMs;
      }
    };
  },

  measureAsync: async (label, asyncFn) => {
    const timer = performanceMonitor.startTimer(label);
    try {
      const result = await asyncFn();
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      logger.error(`Performance measurement failed: ${label}`, { error: error.message });
      throw error;
    }
  }
};

// Health check for logger
const healthCheck = () => {
  try {
    logger.info('Logger health check', { timestamp: new Date().toISOString() });
    return {
      status: 'healthy',
      level: LOG_LEVEL,
      fileLogging: LOG_TO_FILE,
      logDir: LOG_DIR
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Graceful shutdown
const shutdown = () => {
  logger.info('Logger shutting down');
  // Close file handles, flush buffers, etc.
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
  ...logger,
  performance: performanceMonitor,
  healthCheck,
  shutdown,
  
  // Export specialized loggers
  voice: logger.voice,
  integrity: logger.integrity,
  memory: logger.memory
};