// Fixed Real-time Voice Hook using WebSocket connection
import { useCallback, useRef, useState, useEffect } from "react";
import toast from 'react-hot-toast';
import TTSManager from '../lib/voice/tts.js';
import TranscriptionManager from '../lib/voice/transcribe.js';

// Get WebSocket endpoint for voice service
function getVoiceWebSocketEndpoint() {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  return `${wsUrl}/voice`;
}

// Natural voice greetings for TTS
const VOICE_GREETINGS = [
  "Hi there! I'm Durmah, your Legal Eagle Buddy. Welcome back! Just start speaking and I'll help you with any legal questions.",
  "Hello! Great to see you again. I'm ready to assist with your legal studies. What would you like to discuss?",
  "Welcome back to your legal assistant. I'm here to help with case analysis, legal research, or any questions you have. Just speak naturally.",
  "Hi! I'm Durmah, ready to support your legal journey. Feel free to ask me about your modules, assignments, or any legal topics.",
  "Hello there! Your legal assistant is ready. I can help with research, case preparation, or just chat about law. What's on your mind?",
  "Welcome! I'm here to help with all your legal needs. Whether it's coursework, research, or general legal questions - just start talking!"
];

function getRandomVoiceGreeting() {
  return VOICE_GREETINGS[Math.floor(Math.random() * VOICE_GREETINGS.length)];
}

// Function to trigger TTS greeting
async function playVoiceGreeting(ttsManager) {
  const greeting = getRandomVoiceGreeting();
  console.log('[Greeting] Playing voice greeting:', greeting);
  
  try {
    // Send greeting text to TTS service or use ElevenLabs directly
    // For now, we'll use browser speech synthesis as fallback
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(greeting);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.volume = 0.8;
      
      // Try to use a professional voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Samantha') || 
        voice.name.includes('Karen') || 
        voice.name.includes('Daniel') ||
        voice.lang.startsWith('en-')
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      speechSynthesis.speak(utterance);
      return new Promise(resolve => {
        utterance.onend = resolve;
        utterance.onerror = resolve;
      });
    }
  } catch (error) {
    console.error('[Greeting] Error playing voice greeting:', error);
  }
}

export function useRealtimeWebRTC() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [error, setError] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [hasGreeted, setHasGreeted] = useState(false);
  
  const [voiceSettings, setVoiceSettings] = useState({
    inputGain: 1.0,
    outputVolume: 1.0,
    echoCancellation: true,
    noiseSuppression: true
  });

  // WebSocket and audio processing refs
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const ttsManagerRef = useRef(null);
  const transcriptionManagerRef = useRef(null);

  // Initialize managers
  useEffect(() => {
    ttsManagerRef.current = new TTSManager();
    transcriptionManagerRef.current = new TranscriptionManager();

    // Set up TTS callbacks
    ttsManagerRef.current.onSpeakingStart = () => {
      console.log('[TTS] Speaking started');
      setIsSpeaking(true);
      setIsThinking(false);
    };

    ttsManagerRef.current.onSpeakingEnd = () => {
      console.log('[TTS] Speaking ended');
      setIsSpeaking(false);
    };

    // Set up transcription callbacks
    transcriptionManagerRef.current.onSpeechStart = () => {
      console.log('[Transcription] Speech detected');
      setIsListening(true);
      setPartialTranscript('');
    };

    transcriptionManagerRef.current.onSpeechEnd = () => {
      console.log('[Transcription] Speech ended');
      setIsListening(false);
    };

    transcriptionManagerRef.current.onPartialTranscript = (transcript) => {
      console.log('[Transcription] Partial:', transcript);
      setPartialTranscript(transcript);
    };

    transcriptionManagerRef.current.onTranscript = (transcript) => {
      console.log('[Transcription] Final:', transcript);
      setPartialTranscript('');
      addMessage('user', transcript, 'voice');
    };

    return () => {
      // Cleanup
      if (ttsManagerRef.current) ttsManagerRef.current.stop();
    };
  }, [])

  const addMessage = useCallback((sender, text, type = 'text') => {
    const message = {
      id: Date.now() + Math.random(),
      sender,
      text,
      type,
      timestamp: new Date().toISOString()
    };
    console.log('[Message]', sender, ':', text);
    setConversationHistory(prev => [...prev, message]);
  }, []);

  const initializeAudioCapture = useCallback(async () => {
    try {
      console.log('[Audio] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: voiceSettings.echoCancellation,
          noiseSuppression: voiceSettings.noiseSuppression,
          autoGainControl: true,
          sampleRate: 24000
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Create audio context for processing
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
      
      // Resume if suspended (autoplay policy)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Set up audio processing for real-time capture
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (voiceModeActive && wsRef.current?.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          
          // Convert to PCM16 and send to server
          const pcm16Buffer = new Int16Array(inputBuffer.length);
          for (let i = 0; i < inputBuffer.length; i++) {
            pcm16Buffer[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32767));
          }
          
          // Convert to base64 for transmission
          const pcm16Base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16Buffer.buffer)));
          
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: pcm16Base64
          }));
        }
      };
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      audioProcessorRef.current = processor;
      
      console.log('[Audio] Microphone initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[Audio] Failed to initialize microphone:', error);
      setError(`Microphone access failed: ${error.message}`);
      toast.error('Microphone access denied. Please enable microphone permissions.');
      return false;
    }
  }, [voiceSettings, voiceModeActive]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return true;
    
    setError(null);
    setIsConnecting(true);
    console.log("[Durmah] Connecting to voice service...");

    try {
      const wsEndpoint = getVoiceWebSocketEndpoint();
      console.log("[WebSocket] Connecting to:", wsEndpoint);
      
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.onopen = async () => {
          clearTimeout(timeout);
          console.log('[WebSocket] Connected successfully');
          setIsConnected(true);
          setIsConnecting(false);
          
          // Play voice greeting and show message
          if (!hasGreeted) {
            const greeting = getRandomVoiceGreeting();
            console.log('[Greeting] Starting voice greeting...');
            
            // Play voice greeting
            await playVoiceGreeting(ttsManagerRef.current);
            
            // Add to conversation history
            addMessage('durmah', greeting, 'voice');
            setHasGreeted(true);
          }
          
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', event.code, event.reason);
          setIsConnected(false);
          setVoiceModeActive(false);
          setIsListening(false);
          setIsSpeaking(false);
          setIsThinking(false);
          wsRef.current = null;
          
          if (!event.wasClean) {
            setError('Connection lost. Click to reconnect.');
            toast.error('Connection lost. Please try again.');
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[WebSocket] Connection error:', error);
          setError('Failed to connect to voice service');
          toast.error('Failed to connect. Please check your connection.');
          setIsConnecting(false);
          reject(error);
        };
      });

    } catch (error) {
      console.error("[Durmah] Connection failed:", error);
      setError(error.message);
      setIsConnecting(false);
      toast.error("Failed to connect to voice service.");
      return false;
    }
  }, [isConnecting, isConnected, hasGreeted, addMessage]);

  const handleWebSocketMessage = useCallback((message) => {
    console.log('[WebSocket] Received:', message.type, message);
    
    switch (message.type) {
      case 'durmah.ready':
        console.log('[Durmah] Service ready');
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('[Voice State] → Listening');
        transcriptionManagerRef.current?.handleTranscriptionEvent(message);
        setIsListening(true);
        setIsThinking(false);
        setIsSpeaking(false);
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('[Voice State] → Thinking');
        transcriptionManagerRef.current?.handleTranscriptionEvent(message);
        setIsListening(false);
        setIsThinking(true);
        setIsSpeaking(false);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        console.log('[Transcription] Final transcript:', message.transcript);
        transcriptionManagerRef.current?.handleTranscriptionEvent({
          type: message.type,
          transcript: message.transcript
        });
        // Add user message to conversation
        if (message.transcript) {
          addMessage('user', message.transcript, 'voice');
        }
        break;
        
      case 'audio_chunk':
        console.log('[Audio] Received TTS chunk');
        if (message.pcm16 && ttsManagerRef.current) {
          // First audio chunk means we're starting to speak
          if (!isSpeaking) {
            console.log('[Voice State] → Speaking');
            setIsThinking(false);
            setIsSpeaking(true);
            setIsListening(false);
          }
          ttsManagerRef.current.queueAndPlayAudio(message.pcm16, message.sampleRate || 24000);
        }
        break;
        
      case 'audio_end':
        console.log('[Voice State] → Ready (audio ended)');
        setIsThinking(false);
        setIsSpeaking(false);
        // Auto-return to listening mode after a brief pause
        setTimeout(() => {
          if (voiceModeActive) {
            console.log('[Voice State] → Auto-return to Listening');
            setIsListening(true);
          }
        }, 1000);
        break;
        
      case 'transcript':
        console.log('[Response] Received transcript:', message.text);
        addMessage('durmah', message.text, 'voice');
        break;
        
      case 'response.done':
        console.log('[Response] Complete - ready for next input');
        setIsThinking(false);
        // Ensure we're ready for next interaction
        if (!isSpeaking && voiceModeActive) {
          setTimeout(() => {
            setIsListening(true);
          }, 500);
        }
        break;
        
      case 'error':
        console.error('[WebSocket] Service error:', message.message);
        setError(message.message);
        toast.error(`Voice service error: ${message.message}`);
        // Reset states on error
        setIsListening(false);
        setIsThinking(false);
        setIsSpeaking(false);
        break;
        
      default:
        console.log('[WebSocket] Unhandled message type:', message.type);
    }
  }, [addMessage, isSpeaking, voiceModeActive]);

  const disconnect = useCallback(async () => {
    try {
      console.log("[Voice] Disconnecting...");
      setVoiceModeActive(false);
      setIsListening(false);
      setIsSpeaking(false);
      setIsThinking(false);
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Stop audio capture
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop audio processor
      if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      }
      
      // Stop TTS
      if (ttsManagerRef.current) {
        ttsManagerRef.current.stop();
      }
      
      setIsConnected(false);
      setIsConnecting(false);
      setError(null);
      
      console.log("[Voice] Disconnected successfully");
    } catch (e) {
      console.warn("[Voice] Disconnect error:", e);
    }
  }, []);

  const startVoiceMode = useCallback(async () => {
    if (!isConnected) {
      const connected = await connect();
      if (!connected) {
        setVoiceModeActive(false);
        return false;
      }
      
      // Wait a moment for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log("[Voice] Starting voice mode...");
    
    // Initialize audio capture
    const audioInitialized = await initializeAudioCapture();
    if (!audioInitialized) {
      setVoiceModeActive(false);
      return false;
    }
    
    setVoiceModeActive(true);
    console.log("[Voice] Voice mode activated successfully");
    
    // Auto-start listening after greeting (if just connected)
    if (!hasGreeted || conversationHistory.length === 0) {
      setTimeout(() => {
        console.log('[Voice] Auto-starting listening mode...');
        setIsListening(true);
      }, 2000); // Give time for greeting to complete
    }
    
    return true;
  }, [isConnected, connect, initializeAudioCapture, hasGreeted, conversationHistory]);

  const stopVoiceMode = useCallback(async () => {
    console.log("[Voice] Stopping voice mode...");
    setVoiceModeActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsThinking(false);
    
    // Stop audio capture
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop audio processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    
    console.log("[Voice] Voice mode stopped");
  }, []);

  const sendTextMessage = useCallback((text) => {
    if (!text.trim()) return;
    
    // Don't send text messages when in active voice mode
    if (voiceModeActive) {
      toast('Please stop voice mode to send text messages', {
        icon: '🎤',
        duration: 2000
      });
      return;
    }
    
    addMessage('user', text, 'text');
    
    // Send text message to WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      }));
      
      // Trigger response
      wsRef.current.send(JSON.stringify({
        type: 'response.create'
      }));
    } else {
      // Fallback response if not connected
      setTimeout(() => {
        addMessage('durmah', `I received your message: "${text}". Please connect to voice mode for real-time conversation!`, 'text');
      }, 500);
    }
  }, [voiceModeActive, addMessage]);

  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    setPartialTranscript('');
    setHasGreeted(false);
    console.log('[Voice] Conversation cleared');
  }, []);

  return {
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    isThinking,
    voiceModeActive,
    conversationHistory,
    partialTranscript,
    error,
    connectionError: error,
    voiceSettings,
    connect,
    disconnect,
    startVoiceMode,
    stopVoiceMode,
    sendTextMessage,
    clearConversation,
    setVoiceSettings,
  };
}
