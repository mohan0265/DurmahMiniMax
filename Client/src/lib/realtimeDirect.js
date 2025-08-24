// Client/src/lib/realtimeDirect.js - Direct WebSocket connection to realtime voice service
import { PCM16AudioProcessor } from './audio/PCM16AudioProcessor.js';

/**
 * Direct WebSocket connection to the realtime voice service
 * Handles microphone capture, audio processing, and playback
 */

const AUDIO_SAMPLE_RATE = 24000;
const CHUNK_SIZE = 1200; // bytes per chunk for streaming
const VAD_THRESHOLD = 0.01; // Voice Activity Detection threshold

class RealtimeConnection {
  constructor(endpoint, logger, options = {}) {
    this.endpoint = endpoint;
    this.logger = logger;
    this.options = {
      autoGreet: false,
      sampleRate: AUDIO_SAMPLE_RATE,
      ...options
    };
    
    // Connection state
    this.ws = null;
    this.isConnected = false;
    this.isRecording = false;
    this.isPlaying = false;
    
    // Audio components
    this.mediaStream = null;
    this.audioContext = null;
    this.microphone = null;
    this.audioProcessor = null;
    this.playbackProcessor = null;
    
    // Conversation state with enhanced context support
    this.conversationHistory = [];
    this.currentTranscript = '';
    this.isListening = false;
    this.isSpeaking = false;
    this.conversationContext = {
      mode: 'voice',
      messageHistory: [],
      userPreferences: {},
      lastActivity: Date.now()
    };
    
    // Event handlers
    this.eventHandlers = {
      connected: [],
      disconnected: [],
      message: [],
      transcript: [],
      audioStart: [],
      audioEnd: [],
      error: []
    };
  }

  async connect() {
    try {
      this.logger('Connecting to voice service...');
      
      // Get WebSocket endpoint
      const wsEndpoint = this.getWebSocketEndpoint();
      this.logger('WebSocket endpoint:', wsEndpoint);
      
      // Initialize audio context
      await this.initializeAudio();
      
      // Create WebSocket connection
      this.ws = new WebSocket(wsEndpoint);
      
      this.ws.onopen = () => {
        this.isConnected = true;
        this.logger('Connected to voice service');
        this.emit('connected');
        
        if (this.options.autoGreet) {
          this.sendGreeting();
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          this.logger('Error parsing message:', error);
        }
      };
      
      this.ws.onclose = () => {
        this.isConnected = false;
        this.logger('Disconnected from voice service');
        this.emit('disconnected');
      };
      
      this.ws.onerror = (error) => {
        this.logger('WebSocket error:', error);
        this.emit('error', error);
      };
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);
        
        this.on('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
    } catch (error) {
      this.logger('Connection error:', error);
      throw error;
    }
  }

  async initializeAudio() {
    try {
      // Initialize audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.options.sampleRate
      });
      
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Initialize audio processor
      this.audioProcessor = new PCM16AudioProcessor(this.audioContext);
      this.audioProcessor.onAudioData = (pcm16Data) => {
        if (this.isRecording && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendAudioChunk(pcm16Data);
        }
      };
      
      // Connect microphone to processor
      this.microphone.connect(this.audioProcessor.inputNode);
      
      // Initialize playback processor
      this.playbackProcessor = new PCM16AudioProcessor(this.audioContext);
      this.playbackProcessor.outputNode.connect(this.audioContext.destination);
      
      this.logger('Audio initialized successfully');
      
    } catch (error) {
      this.logger('Audio initialization error:', error);
      throw error;
    }
  }

  getWebSocketEndpoint() {
    // Try to get from environment first
    const envEndpoint = import.meta.env?.VITE_SESSION_ENDPOINT;
    if (envEndpoint) {
      return envEndpoint.replace(/^https?:/, 'wss:').replace(/\/api\/realtime.*$/, '') + '/voice';
    }
    
    // Fallback to provided endpoint
    if (this.endpoint) {
      return this.endpoint.replace(/^https?:/, 'wss:').replace(/\/api\/realtime.*$/, '') + '/voice';
    }
    
    // Local development fallback
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'ws://localhost:3001/voice';
    }
    
    throw new Error('No voice service endpoint configured');
  }

  handleMessage(message) {
    this.logger('Received message:', message.type);
    
    switch (message.type) {
      case 'durmah.ready':
        this.addMessage('durmah', message.message, 'system');
        break;
        
      case 'audio_chunk':
        this.playAudioChunk(message);
        break;
        
      case 'audio_end':
        this.handleAudioEnd();
        break;
        
      case 'transcript':
        this.handleTranscript(message.text);
        break;
        
      case 'input_audio_buffer.speech_started':
        this.handleSpeechStarted();
        break;
        
      case 'input_audio_buffer.speech_stopped':
        this.handleSpeechStopped();
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        if (message.transcript) {
          this.addMessage('user', message.transcript, 'voice');
        }
        break;
        
      case 'error':
        this.logger('Service error:', message.message);
        this.emit('error', new Error(message.message));
        break;
        
      default:
        this.logger('Unhandled message type:', message.type);
    }
    
    this.emit('message', message);
  }

  sendAudioChunk(pcm16Data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'input_audio_buffer.append',
        audio: pcm16Data
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  playAudioChunk(message) {
    if (!this.isSpeaking) {
      this.isSpeaking = true;
      this.emit('audioStart');
    }
    
    if (this.playbackProcessor && message.pcm16) {
      this.playbackProcessor.playPCM16(message.pcm16, message.sampleRate || AUDIO_SAMPLE_RATE);
    }
  }

  handleAudioEnd() {
    this.isSpeaking = false;
    this.emit('audioEnd');
  }

  handleTranscript(text) {
    if (text && text.trim()) {
      this.addMessage('durmah', text.trim(), 'voice');
      this.emit('transcript', text.trim());
    }
  }

  handleSpeechStarted() {
    this.isListening = true;
    this.logger('Speech detected');
  }

  handleSpeechStopped() {
    this.isListening = false;
    this.logger('Speech ended');
    
    // Commit the audio buffer
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
  }

  startRecording() {
    if (!this.isConnected) {
      throw new Error('Not connected to voice service');
    }
    
    this.isRecording = true;
    this.audioProcessor?.start();
    this.logger('Recording started');
    
    // Resume audio context if suspended
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  stopRecording() {
    this.isRecording = false;
    this.audioProcessor?.stop();
    this.logger('Recording stopped');
    
    // Commit any remaining audio
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
  }

  sendGreeting() {
    const greeting = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Greet the user warmly and let them know you\'re ready to help with their legal studies.'
      }
    };
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(greeting));
    }
  }

  sendText(text) {
    if (!this.isConnected || !text?.trim()) return;
    
    // Add user message to history
    this.addMessage('user', text.trim(), 'text');
    
    // Send text message to service
    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text.trim()
        }]
      }
    };
    
    this.ws.send(JSON.stringify(message));
    
    // Request response
    const responseRequest = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    };
    
    this.ws.send(JSON.stringify(responseRequest));
  }

  addMessage(sender, text, type = 'text') {
    const message = {
      id: Date.now() + Math.random(),
      sender,
      text,
      type,
      timestamp: new Date().toISOString()
    };
    
    this.conversationHistory.push(message);
    this.logger(`Message added: ${sender} (${type}): ${text.substring(0, 50)}...`);
  }

  // Event system
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  emit(event, ...args) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          this.logger('Event handler error:', error);
        }
      });
    }
  }

  disconnect() {
    this.logger('Disconnecting...');
    
    // Stop recording
    this.stopRecording();
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clean up audio
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isConnected = false;
    this.isRecording = false;
    this.isSpeaking = false;
  }

  // Public API for the widget
  getStatus() {
    return {
      connected: this.isConnected,
      recording: this.isRecording,
      listening: this.isListening,
      speaking: this.isSpeaking
    };
  }

  getConversationHistory() {
    return [...this.conversationHistory];
  }

  clearConversation() {
    this.conversationHistory = [];
    this.logger('Conversation cleared');
  }

  // Mode management methods
  updateMode(mode) {
    if (['voice', 'text'].includes(mode)) {
      this.conversationContext.mode = mode;
      
      // Send mode update to server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const message = {
          type: 'durmah.mode_update',
          mode: mode,
          timestamp: Date.now()
        };
        this.ws.send(JSON.stringify(message));
        this.logger(`Mode updated to: ${mode}`);
      }
    }
  }

  updateConversationContext(context) {
    this.conversationContext = { ...this.conversationContext, ...context };
    
    // Send context update to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'durmah.context_update',
        context: this.conversationContext,
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
      this.logger('Conversation context updated');
    }
  }

  getConversationContext() {
    return {
      ...this.conversationContext,
      messageCount: this.conversationHistory.length,
      lastActivity: Date.now()
    };
  }

  // Enhanced text sending with context
  sendTextWithContext(text, additionalContext = {}) {
    const contextualMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      },
      context: {
        ...this.conversationContext,
        ...additionalContext
      }
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(contextualMessage));
      this.addMessage('user', text, 'text');
      this.logger('Text message sent with context');
    }
  }
}

/**
 * Factory function to create and connect to the realtime service
 */
export async function directRealtimeConnect(endpoint, logger, options = {}) {
  const connection = new RealtimeConnection(endpoint, logger, options);
  await connection.connect();
  
  // Return public interface
  return {
    // Control methods
    startRecording: () => connection.startRecording(),
    stopRecording: () => connection.stopRecording(),
    sendText: (text, context) => context ? connection.sendTextWithContext(text, context) : connection.sendText(text),
    disconnect: () => connection.disconnect(),
    
    // State getters
    getStatus: () => connection.getStatus(),
    getConversation: () => connection.getConversationHistory(),
    clearConversation: () => connection.clearConversation(),
    
    // Mode and context management
    updateMode: (mode) => connection.updateMode(mode),
    updateContext: (context) => connection.updateConversationContext(context),
    getContext: () => connection.getConversationContext(),
    
    // Event subscriptions
    onMessage: (handler) => connection.on('message', handler),
    onTranscript: (handler) => connection.on('transcript', handler),
    onAudioStart: (handler) => connection.on('audioStart', handler),
    onAudioEnd: (handler) => connection.on('audioEnd', handler),
    onError: (handler) => connection.on('error', handler),
    
    // Aliases for compatibility
    stop: () => connection.disconnect(),
    sendText: (text) => connection.sendText(text)
  };
}