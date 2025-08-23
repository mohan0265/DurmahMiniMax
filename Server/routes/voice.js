// Server/routes/voice.js - Voice service API endpoints
const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const VoiceService = require('../services/voice-service');
const IntegrityService = require('../services/integrity-service');
const MemoryService = require('../services/memory-service');

// Voice service health check
router.get('/health', async (req, res) => {
  try {
    const health = await VoiceService.healthCheck();
    const status = health.status === 'healthy' ? 200 : 503;
    
    res.status(status).json({
      service: 'voice',
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (error) {
    logger.error('Voice health check failed:', error);
    res.status(500).json({
      service: 'voice',
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get available voices
router.get('/voices', async (req, res) => {
  try {
    const result = await VoiceService.getAvailableVoices();
    
    if (result.success) {
      res.json({
        success: true,
        voices: result.voices,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        fallback: result.fallback,
        message: result.message,
        available_browser_voices: 'Use speechSynthesis.getVoices() in browser',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Failed to get voices:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: true,
      timestamp: new Date().toISOString()
    });
  }
});

// Text-to-Speech endpoint
router.post('/tts', async (req, res) => {
  try {
    const { text, voice_settings = {}, user_id } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string'
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Text too long (max 1000 characters)'
      });
    }

    // Analyze content for integrity
    const analysis = IntegrityService.analyzeContent(text, {
      source: 'tts_request',
      user_id
    });

    if (!analysis.safe) {
      logger.integrity.flag(user_id || 'anonymous', 'tts_content_flagged', 'medium', {
        text_length: text.length,
        flags: analysis.flags.length
      });
      
      return res.status(400).json({
        success: false,
        error: 'Content violates usage policies',
        code: 'CONTENT_POLICY_VIOLATION'
      });
    }

    // Attempt TTS synthesis
    const result = await VoiceService.synthesizeSpeech(text, voice_settings);
    
    if (result.success) {
      // Return audio data
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': result.audioData.length,
        'X-Audio-Format': result.format,
        'X-Audio-Length': result.length
      });
      
      res.send(result.audioData);
    } else {
      // Return fallback instruction
      res.json({
        success: false,
        fallback: result.fallback,
        text: result.text,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('TTS endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: true,
      message: 'Use browser SpeechSynthesis API',
      timestamp: new Date().toISOString()
    });
  }
});

// Voice settings recommendations
router.get('/settings/:context', (req, res) => {
  const { context } = req.params;
  
  let settings;
  switch (context) {
    case 'crisis':
      settings = VoiceService.getCrisisVoiceSettings();
      break;
    case 'academic':
      settings = VoiceService.getAcademicVoiceSettings();
      break;
    case 'wellbeing':
      settings = VoiceService.getWellbeingVoiceSettings();
      break;
    default:
      settings = VoiceService.getAcademicVoiceSettings();
  }
  
  res.json({
    context,
    settings,
    description: `Optimized voice settings for ${context} interactions`,
    timestamp: new Date().toISOString()
  });
});

// Audio quality analysis (for debugging)
router.post('/analyze-audio', (req, res) => {
  try {
    const { audio_data, sample_rate = 24000, format = 'pcm16' } = req.body;
    
    if (!audio_data) {
      return res.status(400).json({
        success: false,
        error: 'Audio data is required'
      });
    }

    // Convert base64 to audio data for analysis
    let audioArray;
    try {
      const buffer = Buffer.from(audio_data, 'base64');
      
      if (format === 'pcm16') {
        audioArray = VoiceService.convertPCM16ToFloat32(buffer);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Only PCM16 format supported for analysis'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid audio data format'
      });
    }

    const analysis = VoiceService.analyzeAudioQuality(audioArray, sample_rate);
    
    res.json({
      success: true,
      analysis,
      recommendations: {
        rms_too_low: analysis.rms < 0.01 ? 'Audio level too low, increase microphone gain' : null,
        rms_too_high: analysis.rms > 0.8 ? 'Audio level too high, reduce microphone gain' : null,
        clipping: analysis.peak > 0.95 ? 'Audio clipping detected, reduce input level' : null,
        duration_short: analysis.duration < 0.5 ? 'Very short audio clip' : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Audio analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Voice service status
router.get('/status', (req, res) => {
  const status = VoiceService.getStatus();
  res.json({
    service: 'voice',
    timestamp: new Date().toISOString(),
    ...status
  });
});

// OSCOLA citation guidance (voice-optimized)
router.get('/oscola/:type?', (req, res) => {
  const { type = 'general' } = req.params;
  
  try {
    const guidance = IntegrityService.generateOSCOLAGuidance(type);
    
    res.json({
      citation_type: type,
      guidance,
      voice_optimized: true,
      spoken_example: guidance.example ? `For example: ${guidance.example}` : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('OSCOLA guidance error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Crisis resources (voice-optimized)
router.get('/crisis-resources', (req, res) => {
  res.json({
    resources: {
      immediate: {
        samaritans: {
          phone: '116 123',
          description: 'Free 24/7 emotional support',
          spoken: 'Call the Samaritans on 116 123 for immediate support'
        },
        crisis_text_line: {
          text: 'Text SHOUT to 85258',
          description: 'Free 24/7 text support',
          spoken: 'Text the word SHOUT to 85258 for crisis support'
        },
        emergency: {
          phone: '999',
          description: 'Emergency services',
          spoken: 'If you\'re in immediate danger, call 999'
        }
      },
      university: {
        durham_counselling: {
          description: 'Durham University Counselling Service',
          contact: 'counselling.service@durham.ac.uk',
          phone: '0191 334 2200'
        },
        student_support: {
          description: 'Durham Student Support',
          contact: 'student.support@durham.ac.uk'
        }
      },
      legal_profession: {
        lawcare: {
          description: 'Mental health support for legal profession',
          phone: '0800 279 6888',
          website: 'lawcare.org.uk'
        }
      }
    },
    voice_message: 'I\'m concerned about you. Please reach out to someone who can provide immediate support. The Samaritans are available 24/7 on 116 123.',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;