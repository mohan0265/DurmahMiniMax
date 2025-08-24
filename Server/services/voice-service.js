// Server/services/voice-service.js - Voice processing and TTS service
const OpenAI = require('openai');
const logger = require('../lib/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class VoiceService {
  constructor() {
    this.isConfigured = !!process.env.OPENAI_API_KEY;
    this.elevenLabsConfigured = !!process.env.ELEVENLABS_API_KEY;
    
    // Voice settings presets
    this.voicePresets = {
      academic: {
        voice: 'nova',
        speed: 1.0,
        pitch: 1.0,
        stability: 0.8,
        clarity: 0.7
      },
      wellbeing: {
        voice: 'alloy',
        speed: 0.9,
        pitch: 0.95,
        stability: 0.9,
        clarity: 0.8
      },
      crisis: {
        voice: 'nova',
        speed: 0.8,
        pitch: 0.9,
        stability: 0.95,
        clarity: 0.9
      }
    };
  }

  async healthCheck() {
    try {
      if (!this.isConfigured) {
        return {
          status: 'degraded',
          message: 'OpenAI API key not configured',
          features: {
            tts: false,
            realtime: false,
            transcription: false
          }
        };
      }

      // Test OpenAI API connectivity
      await openai.models.list();
      
      return {
        status: 'healthy',
        message: 'Voice service operational',
        features: {
          tts: true,
          realtime: true,
          transcription: true,
          elevenlabs: this.elevenLabsConfigured
        }
      };
    } catch (error) {
      logger.error('Voice service health check failed:', error);
      return {
        status: 'unhealthy',
        message: error.message,
        features: {
          tts: false,
          realtime: false,
          transcription: false
        }
      };
    }
  }

  async getAvailableVoices() {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          fallback: true,
          message: 'OpenAI not configured - use browser speech synthesis',
          voices: []
        };
      }

      // OpenAI TTS voices
      const voices = [
        { id: 'alloy', name: 'Alloy', gender: 'neutral', provider: 'openai' },
        { id: 'echo', name: 'Echo', gender: 'male', provider: 'openai' },
        { id: 'fable', name: 'Fable', gender: 'neutral', provider: 'openai' },
        { id: 'onyx', name: 'Onyx', gender: 'male', provider: 'openai' },
        { id: 'nova', name: 'Nova', gender: 'female', provider: 'openai' },
        { id: 'shimmer', name: 'Shimmer', gender: 'female', provider: 'openai' }
      ];

      // Add ElevenLabs voices if configured
      if (this.elevenLabsConfigured) {
        // Would query ElevenLabs API here
        voices.push({
          id: 'elevenlabs_bella',
          name: 'Bella (ElevenLabs)',
          gender: 'female',
          provider: 'elevenlabs'
        });
      }

      return {
        success: true,
        voices,
        default: 'nova'
      };
    } catch (error) {
      logger.error('Failed to get available voices:', error);
      return {
        success: false,
        fallback: true,
        message: 'Voice service unavailable - use browser speech synthesis',
        voices: []
      };
    }
  }

  async synthesizeSpeech(text, voiceSettings = {}) {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          fallback: true,
          text: text,
          message: 'Use browser speechSynthesis API'
        };
      }

      const settings = {
        voice: 'nova',
        speed: 1.0,
        ...voiceSettings
      };

      logger.debug('Synthesizing speech', {
        textLength: text.length,
        voice: settings.voice,
        speed: settings.speed
      });

      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: settings.voice,
        input: text,
        speed: settings.speed
      });

      const audioData = Buffer.from(await response.arrayBuffer());
      
      logger.info('Speech synthesis completed', {
        textLength: text.length,
        audioSize: audioData.length,
        voice: settings.voice
      });

      return {
        success: true,
        audioData,
        format: 'mp3',
        length: audioData.length,
        voice: settings.voice
      };

    } catch (error) {
      logger.error('Speech synthesis failed:', error);
      return {
        success: false,
        fallback: true,
        text: text,
        message: 'TTS failed - use browser speechSynthesis API',
        error: error.message
      };
    }
  }

  // Voice settings presets
  getAcademicVoiceSettings() {
    return this.voicePresets.academic;
  }

  getWellbeingVoiceSettings() {
    return this.voicePresets.wellbeing;
  }

  getCrisisVoiceSettings() {
    return this.voicePresets.crisis;
  }

  // Audio analysis utilities
  analyzeAudioQuality(audioArray, sampleRate = 24000) {
    if (!audioArray || audioArray.length === 0) {
      return {
        valid: false,
        error: 'No audio data'
      };
    }

    // Calculate basic audio metrics
    const duration = audioArray.length / sampleRate;
    const rms = Math.sqrt(audioArray.reduce((sum, val) => sum + val * val, 0) / audioArray.length);
    const peak = Math.max(...audioArray.map(Math.abs));
    
    // Check for clipping
    const clippedSamples = audioArray.filter(val => Math.abs(val) > 0.95).length;
    const clippingPercentage = (clippedSamples / audioArray.length) * 100;
    
    // Estimate noise floor (bottom 10% of values by amplitude)
    const sortedAmplitudes = audioArray.map(Math.abs).sort((a, b) => a - b);
    const noiseFloor = sortedAmplitudes[Math.floor(sortedAmplitudes.length * 0.1)];
    
    return {
      valid: true,
      duration,
      rms,
      peak,
      clippingPercentage,
      noiseFloor,
      quality: this.assessAudioQuality(rms, peak, clippingPercentage, noiseFloor)
    };
  }

  assessAudioQuality(rms, peak, clippingPercentage, noiseFloor) {
    let score = 100;
    let issues = [];

    // Penalize low signal
    if (rms < 0.01) {
      score -= 30;
      issues.push('Very low signal level');
    } else if (rms < 0.05) {
      score -= 15;
      issues.push('Low signal level');
    }

    // Penalize clipping
    if (clippingPercentage > 5) {
      score -= 40;
      issues.push('Significant audio clipping');
    } else if (clippingPercentage > 1) {
      score -= 20;
      issues.push('Minor audio clipping');
    }

    // Penalize high noise floor
    if (noiseFloor > 0.1) {
      score -= 25;
      issues.push('High noise floor');
    }

    let rating;
    if (score >= 80) rating = 'excellent';
    else if (score >= 60) rating = 'good';
    else if (score >= 40) rating = 'fair';
    else rating = 'poor';

    return {
      score: Math.max(0, score),
      rating,
      issues
    };
  }

  // Convert PCM16 to Float32 for analysis
  convertPCM16ToFloat32(pcm16Buffer) {
    const samples = pcm16Buffer.length / 2; // 2 bytes per sample
    const floatArray = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const sample = pcm16Buffer.readInt16LE(i * 2);
      floatArray[i] = sample / (sample < 0 ? 0x8000 : 0x7FFF);
    }
    
    return floatArray;
  }

  // Service status
  getStatus() {
    return {
      configured: this.isConfigured,
      elevenlabs_configured: this.elevenLabsConfigured,
      available_features: {
        openai_tts: this.isConfigured,
        elevenlabs_tts: this.elevenLabsConfigured,
        audio_analysis: true,
        voice_presets: true
      },
      voice_presets: Object.keys(this.voicePresets)
    };
  }
}

module.exports = new VoiceService();