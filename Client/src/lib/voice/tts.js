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
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async playPCM16Audio(pcm16Base64, sampleRate = 24000) {
    await this.initialize();
    
    try {
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
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, sampleRate);
      audioBuffer.getChannelData(0).set(floatData);
      
      // Play audio
      await this.playAudioBuffer(audioBuffer);
      
    } catch (error) {
      console.error('Error playing PCM16 audio:', error);
      throw error;
    }
  }

  async playAudioBuffer(audioBuffer) {
    return new Promise((resolve, reject) => {
      try {
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Set volume
        gainNode.gain.setValueAtTime(0.8, this.audioContext.currentTime);
        
        source.onended = () => {
          this.isPlaying = false;
          if (this.onSpeakingEnd) this.onSpeakingEnd();
          resolve();
        };
        
        // Start speaking callback
        this.isPlaying = true;
        if (this.onSpeakingStart) this.onSpeakingStart();
        
        source.start(0);
        
      } catch (error) {
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
    while (this.audioQueue.length > 0) {
      const { pcm16Base64, sampleRate } = this.audioQueue.shift();
      try {
        await this.playPCM16Audio(pcm16Base64, sampleRate);
      } catch (error) {
        console.error('Error processing audio queue:', error);
      }
    }
  }

  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
    if (this.onSpeakingEnd) this.onSpeakingEnd();
  }
}

export default TTSManager;