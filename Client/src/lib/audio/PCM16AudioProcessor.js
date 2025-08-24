// Client/src/lib/audio/PCM16AudioProcessor.js - PCM16 audio processing for WebRTC
export class PCM16AudioProcessor {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
    this.isProcessing = false;
    
    // Audio processing nodes
    this.inputNode = null;
    this.outputNode = null;
    this.scriptProcessor = null;
    this.workletNode = null;
    
    // Audio buffers
    this.inputBuffer = [];
    this.outputBuffer = [];
    
    // Callbacks
    this.onAudioData = null;
    
    this.initializeNodes();
  }

  async initializeNodes() {
    try {
      // Try to use AudioWorklet first (modern approach)
      if (this.audioContext.audioWorklet) {
        await this.initializeWorklet();
      } else {
        // Fallback to ScriptProcessorNode (deprecated but widely supported)
        this.initializeScriptProcessor();
      }
    } catch (error) {
      console.warn('AudioWorklet failed, falling back to ScriptProcessor:', error);
      this.initializeScriptProcessor();
    }
  }

  async initializeWorklet() {
    // Register the worklet processor
    const workletCode = `
      class PCM16Processor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 1200; // Target chunk size in bytes
          this.buffer = new Float32Array(this.bufferSize / 2); // PCM16 = 2 bytes per sample
          this.bufferIndex = 0;
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0];
          const output = outputs[0];
          
          if (input.length > 0) {
            const inputChannel = input[0];
            
            // Copy input to output for passthrough
            if (output.length > 0) {
              output[0].set(inputChannel);
            }
            
            // Buffer audio data
            for (let i = 0; i < inputChannel.length; i++) {
              this.buffer[this.bufferIndex] = inputChannel[i];
              this.bufferIndex++;
              
              if (this.bufferIndex >= this.buffer.length) {
                // Convert to PCM16 and send
                const pcm16Data = this.convertToPCM16(this.buffer);
                this.port.postMessage({ type: 'audioData', data: pcm16Data });
                this.bufferIndex = 0;
              }
            }
          }
          
          return true;
        }

        convertToPCM16(floatArray) {
          const pcm16Array = new Int16Array(floatArray.length);
          for (let i = 0; i < floatArray.length; i++) {
            // Clamp and convert float32 (-1 to 1) to int16 (-32768 to 32767)
            const sample = Math.max(-1, Math.min(1, floatArray[i]));
            pcm16Array[i] = sample * (sample < 0 ? 0x8000 : 0x7FFF);
          }
          
          // Convert to base64 string for transmission
          const bytes = new Uint8Array(pcm16Array.buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return btoa(binary);
        }
      }

      registerProcessor('pcm16-processor', PCM16Processor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    
    await this.audioContext.audioWorklet.addModule(workletUrl);
    
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm16-processor');
    this.inputNode = this.workletNode;
    this.outputNode = this.workletNode;
    
    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === 'audioData' && this.onAudioData) {
        this.onAudioData(event.data.data);
      }
    };
    
    URL.revokeObjectURL(workletUrl);
  }

  initializeScriptProcessor() {
    // Create script processor (4096 samples is a good balance)
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.isProcessing) return;
      
      const inputBuffer = event.inputBuffer.getChannelData(0);
      const outputBuffer = event.outputBuffer.getChannelData(0);
      
      // Pass through audio (for monitoring)
      outputBuffer.set(inputBuffer);
      
      // Convert to PCM16 and send chunks
      const pcm16Data = this.convertFloatToPCM16Base64(inputBuffer);
      if (this.onAudioData && pcm16Data) {
        this.onAudioData(pcm16Data);
      }
    };
    
    this.inputNode = this.scriptProcessor;
    this.outputNode = this.scriptProcessor;
  }

  convertFloatToPCM16Base64(floatArray) {
    // Skip very quiet audio to reduce noise
    const rms = Math.sqrt(floatArray.reduce((sum, val) => sum + val * val, 0) / floatArray.length);
    if (rms < 0.01) return null;
    
    const pcm16Array = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      // Clamp and convert float32 (-1 to 1) to int16 (-32768 to 32767)
      const sample = Math.max(-1, Math.min(1, floatArray[i]));
      pcm16Array[i] = sample * (sample < 0 ? 0x8000 : 0x7FFF);
    }
    
    // Convert to base64 string
    const bytes = new Uint8Array(pcm16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  start() {
    this.isProcessing = true;
  }

  stop() {
    this.isProcessing = false;
  }

  // Play PCM16 audio data
  async playPCM16(base64Data, sampleRate = 24000) {
    try {
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert to Int16Array
      const pcm16Array = new Int16Array(bytes.buffer);
      
      // Convert to Float32Array for Web Audio API
      const floatArray = new Float32Array(pcm16Array.length);
      for (let i = 0; i < pcm16Array.length; i++) {
        floatArray[i] = pcm16Array[i] / (pcm16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, floatArray.length, sampleRate);
      audioBuffer.getChannelData(0).set(floatArray);
      
      // Create and play buffer source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode || this.audioContext.destination);
      source.start();
      
    } catch (error) {
      console.error('Error playing PCM16 audio:', error);
    }
  }

  // Utility to convert PCM16 base64 to AudioBuffer
  convertPCM16ToAudioBuffer(base64Data, sampleRate = 24000) {
    try {
      // Decode base64
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert to Int16Array
      const pcm16Array = new Int16Array(bytes.buffer);
      
      // Convert to Float32Array
      const floatArray = new Float32Array(pcm16Array.length);
      for (let i = 0; i < pcm16Array.length; i++) {
        floatArray[i] = pcm16Array[i] / (pcm16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }
      
      // Create AudioBuffer
      const audioBuffer = this.audioContext.createBuffer(1, floatArray.length, sampleRate);
      audioBuffer.getChannelData(0).set(floatArray);
      
      return audioBuffer;
      
    } catch (error) {
      console.error('Error converting PCM16 to AudioBuffer:', error);
      return null;
    }
  }

  // Clean up resources
  disconnect() {
    this.stop();
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    this.inputNode = null;
    this.outputNode = null;
  }
}

// Utility functions for audio format conversion
export const AudioUtils = {
  // Convert Float32 audio to PCM16 base64
  floatToPCM16Base64(floatArray) {
    const pcm16Array = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      const sample = Math.max(-1, Math.min(1, floatArray[i]));
      pcm16Array[i] = sample * (sample < 0 ? 0x8000 : 0x7FFF);
    }
    
    const bytes = new Uint8Array(pcm16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  // Convert PCM16 base64 to Float32 array
  pcm16Base64ToFloat(base64Data) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcm16Array = new Int16Array(bytes.buffer);
    const floatArray = new Float32Array(pcm16Array.length);
    for (let i = 0; i < pcm16Array.length; i++) {
      floatArray[i] = pcm16Array[i] / (pcm16Array[i] < 0 ? 0x8000 : 0x7FFF);
    }
    
    return floatArray;
  },

  // Calculate RMS (Root Mean Square) for audio level detection
  calculateRMS(floatArray) {
    if (!floatArray || floatArray.length === 0) return 0;
    
    const sum = floatArray.reduce((acc, val) => acc + val * val, 0);
    return Math.sqrt(sum / floatArray.length);
  },

  // Simple voice activity detection
  detectVoiceActivity(floatArray, threshold = 0.01) {
    const rms = AudioUtils.calculateRMS(floatArray);
    return rms > threshold;
  }
};