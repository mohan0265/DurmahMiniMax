// Client/src/lib/voice/tts.js - Text-to-Speech with ElevenLabs integration
export class TTSManager {
  constructor() {
    this.audioContext = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.onSpeakingStart = null;
    this.onSpeakingEnd = null;
  }

  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
      console.log('[TTS] Audio context created:', this.audioContext.state);
    }
    
    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      console.log('[TTS] Resuming suspended audio context...');
      await this.audioContext.resume();
      console.log('[TTS] Audio context resumed:', this.audioContext.state);
    }
  }

  async playPCM16Audio(pcm16Base64, sampleRate = 24000) {
    await this.initialize();
    
    try {
      console.log('[TTS] Playing PCM16 audio, length:', pcm16Base64.length, 'sampleRate:', sampleRate);
      
      // Decode base64 PCM16 data
      const binaryString = atob(pcm16Base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert PCM16 bytes to Float32Array
      const pcm16Data = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcm16Data.length);
      
      for (let i = 0; i < pcm16Data.length; i++) {
        floatData[i] = pcm16Data[i] / 32768.0; // Convert to -1.0 to 1.0 range
      }
      
      console.log('[TTS] Decoded PCM16 samples:', floatData.length, 'duration:', floatData.length / sampleRate, 'seconds');
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, sampleRate);
      audioBuffer.getChannelData(0).set(floatData);
      
      // Play audio
      await this.playAudioBuffer(audioBuffer);
      
    } catch (error) {
      console.error('[TTS] Error playing PCM16 audio:', error);
      throw error;
    }
  }

  async playAudioBuffer(audioBuffer) {
    return new Promise((resolve, reject) => {
      try {
        console.log('[TTS] Creating audio source and playing buffer...');
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Set volume - make it louder for better audibility
        gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
        
        source.onended = () => {
          console.log('[TTS] Audio playback ended');
          this.isPlaying = false;
          // Don't call onSpeakingEnd immediately - let queue process
          if (this.audioQueue.length === 0 && this.onSpeakingEnd) {
            this.onSpeakingEnd();
          }
          resolve();
        };
        
        source.onerror = (error) => {
          console.error('[TTS] Audio playback error:', error);
          this.isPlaying = false;
          if (this.onSpeakingEnd) this.onSpeakingEnd();
          reject(error);
        };
        
        // Start speaking callback
        this.isPlaying = true;
        if (this.onSpeakingStart) this.onSpeakingStart();
        
        console.log('[TTS] Starting audio playback...');
        source.start(0);
        
      } catch (error) {
        console.error('[TTS] Error in playAudioBuffer:', error);
        this.isPlaying = false;
        if (this.onSpeakingEnd) this.onSpeakingEnd();
        reject(error);
      }
    });
  }

  async queueAndPlayAudio(pcm16Base64, sampleRate = 24000) {
    // Add to queue and process
    this.audioQueue.push({ pcm16Base64, sampleRate });
    
    if (!this.isPlaying) {
      await this.processAudioQueue();
    }
  }

  async processAudioQueue() {
    console.log('[TTS] Processing audio queue, items:', this.audioQueue.length);
    
    while (this.audioQueue.length > 0) {
      const { pcm16Base64, sampleRate } = this.audioQueue.shift();
      try {
        await this.playPCM16Audio(pcm16Base64, sampleRate);
      } catch (error) {
        console.error('[TTS] Error processing audio queue:', error);
      }
    }
    
    // Queue is empty, we're done speaking
    console.log('[TTS] Audio queue processing complete');
    this.isPlaying = false;
    if (this.onSpeakingEnd) {
      this.onSpeakingEnd();
    }
  }

  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
    if (this.onSpeakingEnd) this.onSpeakingEnd();
  }
}

export default TTSManager;