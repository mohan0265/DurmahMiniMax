// Server/routes/realtime.js - Enhanced realtime session management
const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

// Enhanced session endpoint with TURN server support and better error handling
router.post('/session', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('OpenAI API key not configured');
      return res.status(500).json({ 
        error: 'openai_key_missing',
        message: 'OpenAI API key not configured on server'
      });
    }

    const model = process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-10-01';
    const voice = process.env.OPENAI_VOICE || 'alloy';
    const maxDuration = parseInt(process.env.MAX_SESSION_MINUTES) || 30;

    const sessionConfig = {
      model,
      voice,
      modalities: ['text', 'audio'],
      instructions: getDurmahRealtimeInstructions(),
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1'
      },
      temperature: 0.7,
      max_response_output_tokens: 4000
    };

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: JSON.stringify(sessionConfig)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error(`OpenAI realtime session creation failed: ${response.status} - ${errorText}`);
      
      return res.status(response.status === 429 ? 429 : 502).json({ 
        error: 'openai_api_error',
        message: response.status === 429 ? 
          'OpenAI API rate limit exceeded, please try again later' :
          'Failed to create realtime session',
        status: response.status,
        retry_after: response.headers.get('retry-after') || null
      });
    }

    const session = await response.json();
    const sessionId = session.id;

    // Log session creation for monitoring
    logger.voice.session(sessionId, 'session_created', {
      model,
      voice,
      max_duration: maxDuration,
      client_ip: req.ip
    });

    // Prepare ICE servers (TURN/STUN configuration)
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    // Add TURN servers if configured
    if (process.env.TURN_URL && process.env.TURN_USERNAME) {
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      });
    }

    // Return session configuration to client
    res.json({
      success: true,
      session_id: sessionId,
      client_secret: session.client_secret, // { value, expires_at }
      model: model,
      voice: voice,
      max_duration_minutes: maxDuration,
      ice_servers: iceServers,
      websocket_url: `wss://api.openai.com/v1/realtime?model=${model}`,
      features: {
        voice_activity_detection: true,
        audio_transcription: true,
        text_responses: true,
        audio_responses: true,
        turn_servers_available: !!process.env.TURN_URL
      },
      created_at: new Date().toISOString(),
      expires_at: session.client_secret.expires_at
    });

  } catch (error) {
    logger.error('Realtime session endpoint error:', error);
    
    res.status(500).json({ 
      error: 'session_creation_failed',
      message: 'Internal server error during session creation',
      timestamp: new Date().toISOString()
    });
  }
});

// Session validation endpoint
router.post('/validate-session', (req, res) => {
  const { session_id, client_secret } = req.body;
  
  if (!session_id || !client_secret) {
    return res.status(400).json({
      valid: false,
      error: 'session_id and client_secret required'
    });
  }

  // Basic validation (client_secret should have expires_at)
  if (!client_secret.expires_at) {
    return res.status(400).json({
      valid: false,
      error: 'invalid client_secret format'
    });
  }

  const expiresAt = new Date(client_secret.expires_at * 1000);
  const now = new Date();
  
  if (expiresAt <= now) {
    return res.json({
      valid: false,
      expired: true,
      expired_at: expiresAt.toISOString()
    });
  }

  const remainingTime = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  
  res.json({
    valid: true,
    session_id,
    expires_at: expiresAt.toISOString(),
    remaining_seconds: remainingTime,
    remaining_minutes: Math.floor(remainingTime / 60)
  });
});

// Get supported models
router.get('/models', (req, res) => {
  res.json({
    supported_models: [
      {
        id: 'gpt-4o-realtime-preview-2024-10-01',
        name: 'GPT-4o Realtime Preview',
        description: 'Latest realtime model with voice capabilities',
        recommended: true
      }
    ],
    current_model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-10-01',
    voices: [
      { id: 'alloy', name: 'Alloy', gender: 'neutral', recommended: false },
      { id: 'echo', name: 'Echo', gender: 'male', recommended: false },
      { id: 'fable', name: 'Fable', gender: 'neutral', recommended: false },
      { id: 'onyx', name: 'Onyx', gender: 'male', recommended: false },
      { id: 'nova', name: 'Nova', gender: 'female', recommended: true },
      { id: 'shimmer', name: 'Shimmer', gender: 'female', recommended: false }
    ],
    current_voice: process.env.OPENAI_VOICE || 'alloy'
  });
});

// Connection diagnostics
router.get('/diagnostics', (req, res) => {
  const diagnostics = {
    server_time: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
    turn_configured: !!(process.env.TURN_URL && process.env.TURN_USERNAME),
    max_session_duration: parseInt(process.env.MAX_SESSION_MINUTES) || 30,
    supported_features: {
      realtime_voice: !!process.env.OPENAI_API_KEY,
      turn_servers: !!(process.env.TURN_URL && process.env.TURN_USERNAME),
      session_validation: true,
      audio_transcription: true,
      voice_activity_detection: true
    },
    network: {
      stun_servers: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ],
      turn_server: process.env.TURN_URL || null
    }
  };
  
  res.json(diagnostics);
});

// WebSocket connection test endpoint
router.get('/test-connection', (req, res) => {
  res.json({
    websocket_endpoint: '/voice',
    test_procedure: [
      '1. Create a session using POST /api/realtime/session',
      '2. Connect to WebSocket at /voice',
      '3. Send session authentication with client_secret',
      '4. Begin audio/text interaction',
      '5. Monitor connection health with heartbeats'
    ],
    expected_messages: {
      from_server: [
        'session.ready',
        'response.audio.delta',
        'response.text.delta',
        'input_audio_buffer.speech_started',
        'input_audio_buffer.speech_stopped'
      ],
      from_client: [
        'client.auth',
        'input_audio_buffer.append',
        'input_audio_buffer.commit',
        'response.create'
      ]
    },
    troubleshooting: {
      connection_failed: 'Check network connectivity and firewall settings',
      auth_failed: 'Verify client_secret is valid and not expired',
      audio_issues: 'Check microphone permissions and audio format (PCM16)',
      timeout: 'Sessions expire after configured duration, create new session'
    }
  });
});

function getDurmahRealtimeInstructions() {
  return `You are Durmah, a compassionate AI legal study companion for Durham Law students.

CORE TRAITS:
- Warm, supportive, and encouraging
- Emotionally intelligent with wellbeing awareness
- Professional yet approachable
- Celebrate achievements, provide gentle guidance

EXPERTISE:
- UK legal system and current developments
- Case law analysis and legal reasoning
- Study strategies for law students
- Exam preparation and revision techniques
- Academic writing and legal research
- Stress management and work-life balance

CRITICAL BOUNDARIES:
- NEVER provide professional legal advice for real situations
- Always clarify you're for educational support only
- If crisis/self-harm mentioned, express immediate care and direct to professional help
- Maintain strict academic integrity - guide learning, never do work for students
- Redirect inappropriate requests to educational context

VOICE INTERACTION GUIDELINES:
- Speak naturally and conversationally
- Keep responses concise initially, expand when asked
- Use brief pauses for emphasis
- Acknowledge uncertainty or frustration in student's voice
- Use encouraging verbal cues
- If asked to repeat, vary phrasing while keeping meaning

You're a trusted companion supporting students through their legal education with empathy, expertise, and unwavering academic integrity.`;
}

module.exports = router;