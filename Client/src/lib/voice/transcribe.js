// Client/src/lib/voice/transcribe.js - Real-time transcription utilities
export class TranscriptionManager {
  constructor() {
    this.isActive = false;
    this.onTranscript = null;
    this.onPartialTranscript = null;
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
  }

  // Handle incoming transcription data from the WebSocket connection
  handleTranscriptionEvent(event) {
    const { type, transcript, confidence } = event;
    
    switch (type) {
      case 'input_audio_buffer.speech_started':
        this.isActive = true;
        if (this.onSpeechStart) this.onSpeechStart();
        console.log('[Transcription] Speech started');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        this.isActive = false;
        if (this.onSpeechEnd) this.onSpeechEnd();
        console.log('[Transcription] Speech stopped');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        if (transcript && this.onTranscript) {
          console.log('[Transcription] Final transcript:', transcript);
          this.onTranscript(transcript, confidence || 1.0);
        }
        break;
        
      case 'partial_transcript':
        if (transcript && this.onPartialTranscript) {
          console.log('[Transcription] Partial transcript:', transcript);
          this.onPartialTranscript(transcript, confidence || 0.8);
        }
        break;
        
      default:
        console.log('[Transcription] Unhandled event:', type);
    }
  }

  // Format transcript for display
  formatTranscript(transcript, isPartial = false) {
    if (!transcript) return '';
    
    // Clean up transcript
    let formatted = transcript.trim();
    
    // Add ellipsis for partial transcripts
    if (isPartial && !formatted.endsWith('...')) {
      formatted += '...';
    }
    
    // Capitalize first letter
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    
    return formatted;
  }

  // Check if transcription is likely complete
  isTranscriptComplete(transcript) {
    if (!transcript) return false;
    
    // Basic heuristics for complete sentences
    const endsWithPunctuation = /[.!?]$/.test(transcript.trim());
    const minLength = transcript.trim().length > 3;
    
    return endsWithPunctuation && minLength;
  }

  // Get confidence level description
  getConfidenceDescription(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    if (confidence >= 0.5) return 'low';
    return 'very-low';
  }
}

export default TranscriptionManager;