// Server/services/realtime-voice-enhanced.js - Production-ready WebRTC voice service
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');
const logger = require('../lib/logger');
const MemoryService = require('./memory-service');
const VoiceService = require('./voice-service');
const IntegrityService = require('./integrity-service');

class RealtimeVoiceServiceEnhanced {
  constructor() {
    this.connections = new Map();
    this.sessionStats = new Map();
    this.wss = null;
    
    // Configuration
    this.config = {
      maxConnections: parseInt(process.env.MAX_VOICE_CONNECTIONS) || 100,
      heartbeatInterval: 25000, // 25 seconds
      maxSessionDuration: parseInt(process.env.MAX_SESSION_MINUTES) || 30, // 30 minutes
      enableLogging: process.env.DEBUG_VOICE === 'true',
      turnServers: this.getTurnServers()
    };
  }

  getTurnServers() {
    const servers = [];
    
    if (process.env.TURN_URL && process.env.TURN_USERNAME) {
      servers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      });
    }
    
    // Add public STUN servers as fallback
    servers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    );
    
    return servers;
  }

  initWebSocketServer(server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/voice',
      maxPayload: 16 * 1024 * 1024, // 16MB max payload
      perMessageDeflate: false, // Disable compression for audio
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    // Cleanup interval
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute

    logger.info(`Enhanced voice WebSocket server initialized on /voice`);
    return this.wss;
  }

  async handleConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    const clientIP = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Rate limiting check
    if (this.connections.size >= this.config.maxConnections) {
      logger.warn(`Connection limit reached (${this.config.maxConnections}), rejecting connection`);
      ws.close(1013, 'Service overloaded');
      return;
    }

    logger.voice.connection(connectionId, 'connected', {
      ip: clientIP,
      userAgent: userAgent?.substring(0, 100)
    });

    // Initialize connection state
    const connectionState = {
      id: connectionId,
      ws,
      clientIP,
      connectedAt: new Date(),
      lastActivity: new Date(),
      isAlive: true,
      openaiWs: null,
      userId: null,
      conversationId: null,
      sessionStats: {
        messagesReceived: 0,
        messagesSent: 0,
        audioChunksReceived: 0,
        audioChunksSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        errors: 0
      }
    };

    this.connections.set(connectionId, connectionState);
    
    // Set up heartbeat
    this.attachHeartbeat(ws, connectionId);
    
    // Handle messages
    ws.on('message', async (data) => {
      await this.handleMessage(connectionId, data);
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(connectionId, code, reason);
    });

    ws.on('error', (error) => {
      logger.voice.error(connectionId, error, { phase: 'client_connection' });
      connectionState.sessionStats.errors++;
    });

    // Initialize OpenAI Realtime session
    await this.initRealtimeSession(connectionId);
  }

  async initRealtimeSession(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      logger.voice.session(connectionId, 'initializing_openai');

      const openaiWs = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-10-01'}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1',
          },
          handshakeTimeout: 10000,
        }
      );

      connection.openaiWs = openaiWs;
      this.attachHeartbeat(openaiWs, `${connectionId}-openai`);

      openaiWs.on('open', () => {
        logger.voice.session(connectionId, 'openai_connected');
        this.setupRealtimeSession(connectionId);
      });

      openaiWs.on('message', async (data) => {
        await this.handleOpenAIMessage(connectionId, data);
      });

      openaiWs.on('close', (code, reason) => {
        logger.voice.session(connectionId, 'openai_disconnected', {
          code,
          reason: reason?.toString()
        });
        
        // Attempt to reconnect if client is still connected
        if (connection.ws.readyState === WebSocket.OPEN) {
          setTimeout(() => {
            this.initRealtimeSession(connectionId);
          }, 2000);
        }
      });

      openaiWs.on('error', (error) => {
        logger.voice.error(connectionId, error, { phase: 'openai_connection' });
        connection.sessionStats.errors++;
      });

      // Session timeout
      setTimeout(() => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          logger.voice.session(connectionId, 'session_timeout');
          connection.ws.close(1000, 'Session timeout');
        }
      }, this.config.maxSessionDuration * 60 * 1000);

    } catch (error) {
      logger.voice.error(connectionId, error, { phase: 'session_init' });
      
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to initialize voice session',
          code: 'SESSION_INIT_FAILED'
        }));
      }
    }
  }

  setupRealtimeSession(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection?.openaiWs) return;

    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.getDurmahInstructions(),
        voice: process.env.OPENAI_VOICE || 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        tools: [],
        tool_choice: 'auto',
        temperature: 0.7,
        max_response_output_tokens: 'inf'
      }
    };

    this.sendToOpenAI(connectionId, sessionConfig);
    
    // Send ready message to client
    this.sendToClient(connectionId, {
      type: 'session.ready',
      message: 'Hello! I\'m Durmah, your Legal Eagle Buddy. I\'m listening and ready to help with your legal studies.',
      turn_servers: this.config.turnServers,
      session_id: connectionId
    });
  }

  async handleMessage(connectionId, rawData) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = new Date();
    connection.sessionStats.messagesReceived++;
    connection.sessionStats.bytesReceived += rawData.length;

    try {
      let message;
      
      // Handle both JSON and binary data
      if (rawData instanceof Buffer) {
        try {
          message = JSON.parse(rawData.toString());
        } catch {
          // Assume binary audio data
          message = {
            type: 'input_audio_buffer.append',
            audio: rawData.toString('base64')
          };
        }
      } else {
        message = JSON.parse(rawData);
      }

      // Track audio chunks
      if (message.type === 'input_audio_buffer.append') {
        connection.sessionStats.audioChunksReceived++;
      }

      // Handle special client messages
      if (message.type === 'client.auth') {
        await this.handleClientAuth(connectionId, message);
        return;
      }

      if (message.type === 'client.session_info') {
        await this.handleSessionInfo(connectionId, message);
        return;
      }

      // Forward to OpenAI
      this.sendToOpenAI(connectionId, message);

    } catch (error) {
      logger.voice.error(connectionId, error, { phase: 'message_handling' });
      connection.sessionStats.errors++;
      
      this.sendToClient(connectionId, {
        type: 'error',
        message: 'Failed to process message',
        code: 'MESSAGE_PROCESSING_FAILED'
      });
    }
  }

  async handleOpenAIMessage(connectionId, rawData) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message = JSON.parse(rawData.toString());
      
      // Log important events
      if (this.config.enableLogging) {
        if (['response.audio.delta', 'input_audio_buffer.speech_started'].includes(message.type)) {
          logger.voice.session(connectionId, message.type, {
            audio_length: message.delta?.length || 'n/a'
          });
        }
      }

      // Track audio output
      if (message.type === 'response.audio.delta') {
        connection.sessionStats.audioChunksSent++;
      }

      // Handle transcript events for memory storage
      if (message.type === 'conversation.item.input_audio_transcription.completed') {
        await this.handleUserTranscript(connectionId, message.transcript);
      }

      if (message.type === 'response.text.delta' || message.type === 'response.text.done') {
        await this.handleAssistantMessage(connectionId, message);
      }

      // Forward to client
      this.sendToClient(connectionId, message);
      
    } catch (error) {
      logger.voice.error(connectionId, error, { phase: 'openai_message' });
      connection.sessionStats.errors++;
    }
  }

  async handleClientAuth(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Extract user information from auth message
    connection.userId = message.user_id;
    connection.sessionToken = message.session_token;
    
    // Create or get conversation
    if (connection.userId) {
      connection.conversationId = await MemoryService.getOrCreateConversation(
        connection.userId,
        {
          type: 'voice',
          title: 'Voice Session',
          metadata: {
            connection_id: connectionId,
            started_at: new Date().toISOString()
          }
        }
      );
    }

    this.sendToClient(connectionId, {
      type: 'client.auth_success',
      user_id: connection.userId,
      conversation_id: connection.conversationId?.id
    });
  }

  async handleSessionInfo(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Update session metadata
    Object.assign(connection, {
      userAgent: message.user_agent,
      browserInfo: message.browser_info,
      audioCapabilities: message.audio_capabilities
    });

    logger.voice.session(connectionId, 'session_info_updated', {
      browser: message.browser_info?.name,
      audio_input: message.audio_capabilities?.input,
      audio_output: message.audio_capabilities?.output
    });
  }

  async handleUserTranscript(connectionId, transcript) {
    const connection = this.connections.get(connectionId);
    if (!connection?.userId || !transcript) return;

    try {
      // Analyze content for integrity concerns
      const analysis = IntegrityService.analyzeContent(transcript, {
        source: 'voice',
        connection_id: connectionId
      });

      if (!analysis.safe) {
        logger.voice.session(connectionId, 'content_flagged', {
          flags: analysis.flags.length,
          severity: analysis.flags[0]?.severity
        });

        // Handle crisis situations immediately
        if (analysis.flags.some(f => f.type === 'crisis')) {
          await MemoryService.flagCrisis(
            connection.userId,
            connection.conversationId?.id,
            null, // No message ID for voice
            {
              triggerWords: analysis.flags[0].keywords,
              severityScore: analysis.flags[0].score,
              messageSnippet: transcript.substring(0, 200)
            }
          );
        }
      }

      // Save transcript to memory
      if (connection.conversationId) {
        await MemoryService.saveMessage(
          connection.userId,
          connection.conversationId.id,
          'user',
          transcript,
          {
            type: 'voice',
            source: 'whisper_transcription',
            integrity_analysis: analysis,
            connection_id: connectionId
          }
        );
      }

    } catch (error) {
      logger.voice.error(connectionId, error, { phase: 'transcript_handling' });
    }
  }

  async handleAssistantMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection?.userId) return;

    try {
      let content = '';
      
      if (message.type === 'response.text.delta') {
        content = message.delta || '';
      } else if (message.type === 'response.text.done') {
        content = message.text || '';
      }

      if (content && connection.conversationId) {
        await MemoryService.saveMessage(
          connection.userId,
          connection.conversationId.id,
          'durmah',
          content,
          {
            type: 'voice',
            source: 'realtime_api',
            connection_id: connectionId,
            model: 'gpt-4o-realtime'
          }
        );
      }

    } catch (error) {
      logger.voice.error(connectionId, error, { phase: 'assistant_message' });
    }
  }

  sendToOpenAI(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection?.openaiWs || connection.openaiWs.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.openaiWs.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.voice.error(connectionId, error, { phase: 'send_to_openai' });
      return false;
    }
  }

  sendToClient(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection?.ws || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      connection.sessionStats.messagesSent++;
      connection.sessionStats.bytesSent += JSON.stringify(message).length;
      return true;
    } catch (error) {
      logger.voice.error(connectionId, error, { phase: 'send_to_client' });
      return false;
    }
  }

  attachHeartbeat(ws, label) {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const heartbeatInterval = setInterval(() => {
      if (ws.isAlive === false) {
        logger.warn(`Heartbeat timeout for ${label}, terminating connection`);
        ws.terminate();
        clearInterval(heartbeatInterval);
        return;
      }
      
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, this.config.heartbeatInterval);

    ws.on('close', () => clearInterval(heartbeatInterval));
    ws.on('error', () => clearInterval(heartbeatInterval));
  }

  handleDisconnection(connectionId, code, reason) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const duration = Date.now() - connection.connectedAt.getTime();
    
    logger.voice.connection(connectionId, 'disconnected', {
      code,
      reason: reason?.toString(),
      duration: Math.round(duration / 1000) + 's',
      stats: connection.sessionStats
    });

    // Close OpenAI connection
    if (connection.openaiWs) {
      try {
        connection.openaiWs.close();
      } catch (error) {
        logger.debug('Error closing OpenAI WebSocket:', error.message);
      }
    }

    // Store session stats if user was identified
    if (connection.userId) {
      this.sessionStats.set(connectionId, {
        userId: connection.userId,
        duration,
        stats: connection.sessionStats,
        endTime: new Date()
      });
    }

    this.connections.delete(connectionId);
  }

  cleanup() {
    const now = Date.now();
    const maxIdleTime = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connection] of this.connections.entries()) {
      const idleTime = now - connection.lastActivity.getTime();
      
      if (idleTime > maxIdleTime) {
        logger.voice.connection(connectionId, 'cleanup_idle');
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1000, 'Idle timeout');
        }
      }
    }

    // Clean old session stats
    const maxAge = 60 * 60 * 1000; // 1 hour
    for (const [sessionId, stats] of this.sessionStats.entries()) {
      if (now - stats.endTime.getTime() > maxAge) {
        this.sessionStats.delete(sessionId);
      }
    }
  }

  async closeAllConnections() {
    logger.info(`Closing ${this.connections.size} voice connections`);
    
    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1001, 'Server shutdown');
        }
        if (connection.openaiWs?.readyState === WebSocket.OPEN) {
          connection.openaiWs.close();
        }
      } catch (error) {
        logger.debug(`Error closing connection ${connectionId}:`, error.message);
      }
    }
    
    this.connections.clear();
    
    if (this.wss) {
      this.wss.close();
    }
  }

  generateConnectionId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  getDurmahInstructions() {
    return `You are Durmah, a compassionate AI legal study companion designed specifically for Durham Law students. Your core characteristics:

🦅 PERSONALITY:
- Warm, supportive, and encouraging like a trusted study partner
- Emotionally intelligent with strong wellbeing awareness
- Professional yet approachable, never condescending
- Celebrate achievements and provide gentle guidance through struggles

📚 EXPERTISE:
- UK legal system, principles, and current developments
- Case law analysis and legal reasoning techniques
- Study strategies optimized for law students
- Exam preparation and revision techniques
- Academic writing and legal research methods
- Stress management and work-life balance for law students

⚖️ CRITICAL BOUNDARIES:
- NEVER provide professional legal advice for real-world situations
- Always clarify you're for educational support only
- If someone mentions crisis/self-harm, express immediate care and direct to professional help
- Redirect inappropriate requests back to educational context
- Maintain strict academic integrity - guide learning, never do work for students

💜 RESPONSE STYLE:
- Keep initial responses concise (1-2 sentences), expand when asked
- Use natural, conversational language
- Include relevant examples from well-known cases when helpful
- Always suggest next steps or follow-up questions
- Proactively check on student wellbeing when stress indicators appear
- Use OSCOLA citation format when referencing legal sources

🎯 VOICE INTERACTION OPTIMIZATIONS:
- Speak naturally and conversationally
- Use brief pauses for emphasis, not long silences
- If asked to repeat, vary your phrasing while keeping the same meaning
- Acknowledge when you hear uncertainty or frustration in the student's voice
- Use encouraging verbal cues like "That's a great question" or "You're on the right track"

Remember: You're not just an AI assistant - you're a trusted companion supporting students through their legal education journey with empathy, expertise, and unwavering academic integrity.`;
  }

  getStats() {
    return {
      active_connections: this.connections.size,
      total_sessions: this.sessionStats.size,
      server_uptime: process.uptime(),
      connections: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        connected_at: conn.connectedAt,
        last_activity: conn.lastActivity,
        user_id: conn.userId,
        stats: conn.sessionStats
      })),
      config: this.config
    };
  }
}

module.exports = RealtimeVoiceServiceEnhanced;