// Server/services/voice-service.js - TTS and voice processing
const axios = require('axios');
const logger = require('../lib/logger');

class VoiceService {
  constructor() {
    this.elevenLabsKey = null;
    this.elevenLabsVoiceId = null;
    this.elevenLabsModel = null;
    this.initialized = false;
    this.fallbackMode = false;
  }

  init() {
    try {
      this.elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      this.elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || 'ErXwobaYiN019PkySvjV'; // Antoni voice
      this.elevenLabsModel = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

      if (!this.elevenLabsKey) {
        logger.warn('ElevenLabs API key not found, using browser TTS fallback');
        this.fallbackMode = true;
      } else {
        logger.info('Voice service initialized with ElevenLabs TTS');
        this.fallbackMode = false;
      }

      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize voice service:', error);
      this.fallbackMode = true;
      this.initialized = true; // Still allow fallback
      return false;
    }
  }

  // Text-to-Speech with ElevenLabs
  async synthesizeSpeech(text, options = {}) {
    if (!this.initialized) {
      throw new Error('Voice service not initialized');
    }

    // If no ElevenLabs key, return fallback instruction
    if (this.fallbackMode) {
      return {
        success: false,
        fallback: true,
        message: 'Use browser SpeechSynthesis API',
        text: text
      };
    }

    try {
      const requestData = {
        text: text,
        model_id: options.model || this.elevenLabsModel,
        voice_settings: {
          stability: options.stability || 0.75,
          similarity_boost: options.similarityBoost || 0.75,
          style: options.style || 0.0,
          use_speaker_boost: options.useSpeakerBoost || true
        }
      };

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}/stream`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.elevenLabsKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.status === 200) {
        return {
          success: true,
          audioData: Buffer.from(response.data),
          format: 'mp3',
          length: response.data.byteLength
        };
      } else {
        throw new Error(`ElevenLabs API returned status ${response.status}`);
      }
    } catch (error) {
      logger.error('ElevenLabs TTS failed:', error);
      
      // Return fallback instruction
      return {
        success: false,
        fallback: true,
        error: error.message,
        message: 'Use browser SpeechSynthesis API',
        text: text
      };
    }
  }

  // Get available voices (ElevenLabs)
  async getAvailableVoices() {
    if (!this.initialized || this.fallbackMode) {
      return {
        success: false,
        fallback: true,
        message: 'ElevenLabs not available, use browser voices'
      };
    }

    try {
      const response = await axios.get(
        'https://api.elevenlabs.io/v1/voices',
        {
          headers: {
            'xi-api-key': this.elevenLabsKey
          },
          timeout: 5000
        }
      );

      if (response.status === 200) {
        return {
          success: true,
          voices: response.data.voices.map(voice => ({
            id: voice.voice_id,
            name: voice.name,
            category: voice.category,
            description: voice.description
          }))
        };
      } else {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }
    } catch (error) {
      logger.error('Failed to get ElevenLabs voices:', error);
      return {
        success: false,
        fallback: true,
        error: error.message,
        message: 'ElevenLabs not available, use browser voices'
      };
    }
  }

  // Voice activity detection helpers
  detectVoiceActivity(audioData, threshold = 0.01) {
    if (!audioData || audioData.length === 0) {
      return false;
    }

    // Simple RMS-based VAD
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    
    return rms > threshold;
  }

  // Audio format conversion helpers
  convertPCM16ToFloat32(pcm16Data) {
    const float32Data = new Float32Array(pcm16Data.length / 2);
    
    for (let i = 0; i < float32Data.length; i++) {
      const int16 = (pcm16Data[i * 2 + 1] << 8) | pcm16Data[i * 2];
      // Convert from signed 16-bit to float32 (-1 to 1)
      float32Data[i] = int16 >= 0x8000 ? (int16 - 0x10000) / 0x8000 : int16 / 0x7FFF;
    }
    
    return float32Data;
  }

  convertFloat32ToPCM16(float32Data) {
    const pcm16Data = new Int16Array(float32Data.length);
    
    for (let i = 0; i < float32Data.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit signed integer
      const clamped = Math.max(-1, Math.min(1, float32Data[i]));
      pcm16Data[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    }
    
    return pcm16Data;
  }

  // Audio quality analysis
  analyzeAudioQuality(audioData, sampleRate = 24000) {
    if (!audioData || audioData.length === 0) {
      return {
        rms: 0,
        peak: 0,
        duration: 0,
        quality: 'no-audio'
      };
    }

    let sum = 0;
    let peak = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const abs = Math.abs(audioData[i]);
      sum += audioData[i] * audioData[i];
      peak = Math.max(peak, abs);
    }
    
    const rms = Math.sqrt(sum / audioData.length);
    const duration = audioData.length / sampleRate;
    
    let quality = 'good';
    if (rms < 0.001) quality = 'very-quiet';
    else if (rms < 0.01) quality = 'quiet';
    else if (peak > 0.95) quality = 'clipping';
    
    return {
      rms: rms,
      peak: peak,
      duration: duration,
      quality: quality
    };
  }

  // Generate voice response metadata
  generateResponseMetadata(text, audioData, options = {}) {
    return {
      textLength: text.length,
      wordCount: text.split(/\s+/).length,
      audioLength: audioData ? audioData.length : 0,
      format: options.format || 'pcm16',
      sampleRate: options.sampleRate || 24000,
      synthesisTime: options.synthesisTime || Date.now(),
      voice: options.voice || this.elevenLabsVoiceId,
      model: options.model || this.elevenLabsModel,
      fallbackUsed: this.fallbackMode
    };
  }

  // Crisis response voice settings (urgent, clear)
  getCrisisVoiceSettings() {
    return {
      stability: 0.85, // More stable for clarity
      similarityBoost: 0.85,
      style: 0.1, // Neutral style
      useSpeakerBoost: true,
      model: 'eleven_multilingual_v2' // More reliable model
    };
  }

  // Academic voice settings (professional, warm)
  getAcademicVoiceSettings() {
    return {
      stability: 0.75,
      similarityBoost: 0.75,
      style: 0.2, // Slightly more expressive
      useSpeakerBoost: true,
      model: this.elevenLabsModel
    };
  }

  // Wellbeing voice settings (gentle, supportive)
  getWellbeingVoiceSettings() {
    return {
      stability: 0.8,
      similarityBoost: 0.7,
      style: 0.3, // More expressive and warm
      useSpeakerBoost: true,
      model: this.elevenLabsModel
    };
  }

  // Health check
  async healthCheck() {
    if (!this.initialized) {
      return {
        status: 'not-initialized',
        fallbackAvailable: true
      };
    }

    if (this.fallbackMode) {
      return {
        status: 'fallback-mode',
        service: 'browser-tts',
        message: 'ElevenLabs not available, using browser TTS'
      };
    }

    try {
      // Test API connectivity
      const response = await axios.get(
        'https://api.elevenlabs.io/v1/user',
        {
          headers: { 'xi-api-key': this.elevenLabsKey },
          timeout: 5000
        }
      );

      return {
        status: 'healthy',
        service: 'elevenlabs',
        subscription: response.data?.subscription?.tier || 'unknown',
        charactersUsed: response.data?.subscription?.character_count || 0,
        charactersLimit: response.data?.subscription?.character_limit || 0
      };
    } catch (error) {
      logger.error('ElevenLabs health check failed:', error);
      return {
        status: 'unhealthy',
        service: 'elevenlabs',
        error: error.message,
        fallbackAvailable: true
      };
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      fallbackMode: this.fallbackMode,
      service: this.fallbackMode ? 'browser-tts' : 'elevenlabs',
      voiceId: this.elevenLabsVoiceId,
      model: this.elevenLabsModel
    };
  }
}

// Export singleton instance
module.exports = new VoiceService();