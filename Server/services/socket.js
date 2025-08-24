const jwt = require('jsonwebtoken');

const initializeSocket = (io, logger) => {
  // Authentication middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);
    
    // Join user's personal room
    socket.join(`user_${socket.userId}`);
    
    // Send welcome message
    socket.emit('welcome', {
      message: 'Welcome to Durmah! 🦅',
      timestamp: new Date()
    });

    // Handle chat messages
    socket.on('chat_message', async (data) => {
      try {
        // Process message
        logger.info(`Message from ${socket.userId}: ${data.message}`);
        
        // Emit typing indicator
        socket.emit('typing', true);
        
        // Simulate processing time
        setTimeout(() => {
          socket.emit('typing', false);
          socket.emit('response', {
            message: 'I received your message!',
            timestamp: new Date()
          });
        }, 1000);
        
      } catch (error) {
        logger.error('Socket message error:', error);
        socket.emit('error', 'Failed to process message');
      }
    });

    // Handle mood updates
    socket.on('mood_update', (mood) => {
      logger.info(`Mood update from ${socket.userId}: ${mood}`);
      
      socket.emit('mood_response', {
        message: getMoodResponse(mood),
        timestamp: new Date()
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });
};

const getMoodResponse = (mood) => {
  const responses = {
    great: "That's wonderful! Let's make the most of this positive energy! 🌟",
    good: "Glad to hear you're doing well! Ready to learn? 📚",
    okay: "That's perfectly fine. We'll take things at your pace today. 💜",
    stressed: "I hear you. Let's work through this together, one step at a time. 🤗",
    overwhelmed: "Thank you for being honest. Remember, you're not alone. Let's start with something small. 💪"
  };
  
  return responses[mood] || "I'm here for you, whatever you need. 💜";
};

module.exports = { initializeSocket };