// Client/src/hooks/useRealtimeWebRTC.ts - Enhanced voice hook with ultra-low latency
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

// Types
interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type: 'text' | 'audio';
  duration?: number;
}

interface VoiceSettings {
  inputGain: number;
  outputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

interface SessionConfig {
  model?: string;
  voice?: string;
  maxDuration?: number;
}

// Debug flag
const DEBUG_VOICE = import.meta.env.VITE_DEBUG_VOICE === "true" || 
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

// Audio utilities
function pcm16Base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const len = bin.length / 2;
  const out = new Float32Array(len);
  let o = 0;
  for (let i = 0; i < len; i++) {
    const lo = bin.charCodeAt(o++);
    const hi = bin.charCodeAt(o++);
    let v = (hi << 8) | lo;
    if (v & 0x8000) v -= 0x10000;
    out[i] = Math.max(-1, Math.min(1, v / 32768));
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

// Enhanced audio queue with barge-in capability
class AudioQueue {
  private ctx: AudioContext;
  private current: AudioBufferSourceNode | null = null;
  private queue: { data: Float32Array; rate: number }[] = [];
  private playing = false;
  private interrupted = false;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onInterrupted?: () => void;

  constructor(ctx?: AudioContext) {
    this.ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
      latencyHint: 'interactive'
    });
  }

  async ensureResumed(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  // Barge-in: interrupt current playback immediately
  interrupt(): void {
    if (DEBUG_VOICE) console.log("[AudioQueue] Interrupting playback");
    
    this.interrupted = true;
    
    if (this.current) {
      try {
        this.current.stop(0);
        this.current.disconnect();
      } catch (e) {
        // Ignore errors when stopping
      }
      this.current = null;
    }
    
    // Clear queue
    this.queue = [];
    this.playing = false;
    
    this.onInterrupted?.();
  }

  stop(): void {
    this.interrupt();
  }

  enqueuePCM16Base64(b64: string, rate = 24000): void {
    if (this.interrupted) {
      this.interrupted = false; // Reset for new audio
    }
    
    const f32 = pcm16Base64ToFloat32(b64);
    this.queue.push({ data: f32, rate });
    
    if (!this.playing) {
      this.drain();
    }
  }

  private async drain(): Promise<void> {
    if (this.playing || this.interrupted) return;
    
    this.playing = true;
    this.onPlaybackStart?.();
    
    await this.ensureResumed();
    
    while (this.queue.length > 0 && !this.interrupted) {
      const { data, rate } = this.queue.shift()!;
      
      if (data.length === 0) continue;
      
      const buffer = this.ctx.createBuffer(1, data.length, rate);
      buffer.getChannelData(0).set(data);
      
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      
      await new Promise<void>((resolve) => {
        if (this.interrupted) {
          resolve();
          return;
        }
        
        this.current = source;
        source.onended = () => {
          this.current = null;
          resolve();
        };
        
        try {
          source.start();
        } catch (e) {
          resolve();
        }
      });
    }
    
    this.playing = false;
    this.current = null;
    this.onPlaybackEnd?.();
  }

  getState(): 'idle' | 'playing' | 'interrupted' {
    if (this.interrupted) return 'interrupted';
    if (this.playing) return 'playing';
    return 'idle';
  }
}

export function useRealtimeWebRTC() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  // Transcripts
  const [userTranscript, setUserTranscript] = useState("");
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [conversationHistory, setConversationHistory] = useState<VoiceMessage[]>([]);
  
  // Settings and config
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    inputGain: 1.0,
    outputVolume: 1.0,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  });
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioPlayerRef = useRef<AudioQueue | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionConfigRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bargeInTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Utility functions
  const log = useCallback((...args: any[]) => {
    if (DEBUG_VOICE) console.log("[useRealtimeWebRTC]", ...args);
  }, []);

  // Initialize audio context and player
  const initializeAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
        latencyHint: 'interactive'
      });
    }
    
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new AudioQueue(audioCtxRef.current);
      
      audioPlayerRef.current.onPlaybackStart = () => {
        setIsSpeaking(true);
        log("Audio playback started");
      };
      
      audioPlayerRef.current.onPlaybackEnd = () => {
        setIsSpeaking(false);
        log("Audio playback ended");
      };
      
      audioPlayerRef.current.onInterrupted = () => {
        setIsSpeaking(false);
        log("Audio playback interrupted (barge-in)");
      };
    }
  }, [log]);

  // Create session with backend
  const createSession = useCallback(async (config: SessionConfig = {}) => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '/api';
      const response = await fetch(`${apiBase}/realtime/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create session');
      }
      
      const sessionData = await response.json();
      sessionConfigRef.current = sessionData;
      
      log("Session created:", {
        id: sessionData.session_id,
        model: sessionData.model,
        voice: sessionData.voice,
        expires_at: sessionData.expires_at
      });
      
      return sessionData;
    } catch (error) {
      log("Session creation failed:", error);
      throw error;
    }
  }, [log]);

  // WebSocket connection with enhanced error handling
  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log("WebSocket already connected");
      return true;
    }
    
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      // Create session first
      const session = await createSession();
      
      // Determine WebSocket URL
      const wsUrl = session.websocket_url || (
        import.meta.env.VITE_API_BASE?.replace(/^http/, 'ws') + '/voice'
      );
      
      log("Connecting to WebSocket:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 10000); // 10 second timeout
        
        ws.onopen = () => {
          clearTimeout(timeout);
          log("WebSocket connected");
          
          // Send authentication
          ws.send(JSON.stringify({
            type: 'client.auth',
            client_secret: session.client_secret,
            session_id: session.session_id,
            user_agent: navigator.userAgent,
            audio_capabilities: {
              input: true,
              output: true,
              sample_rate: 24000
            }
          }));
          
          setIsConnected(true);
          setIsConnecting(false);
          resolve(true);
        };
        
        ws.onmessage = (event) => {
          handleWebSocketMessage(JSON.parse(event.data));
        };
        
        ws.onclose = (event) => {
          clearTimeout(timeout);
          log("WebSocket closed:", event.code, event.reason);
          
          setIsConnected(false);
          setIsConnecting(false);
          setIsListening(false);
          setIsSpeaking(false);
          setIsThinking(false);
          
          // Auto-reconnect logic
          if (event.code !== 1000 && event.code !== 1001) {
            log("Attempting to reconnect...");
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, 2000);
          }
          
          resolve(false);
        };
        
        ws.onerror = (error) => {
          clearTimeout(timeout);
          log("WebSocket error:", error);
          setConnectionError("Connection failed");
          setIsConnecting(false);
          resolve(false);
        };
      });
      
    } catch (error) {
      log("WebSocket connection failed:", error);
      setConnectionError((error as Error).message);
      setIsConnecting(false);
      return false;
    }
  }, [createSession, log]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    log("Received message:", message.type, message);
    
    switch (message.type) {
      case 'session.ready':
        log("Session ready");
        break;
        
      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        setIsThinking(false);
        
        // Barge-in: interrupt any ongoing playback
        if (audioPlayerRef.current && audioPlayerRef.current.getState() === 'playing') {
          log("Barge-in detected - interrupting playback");
          audioPlayerRef.current.interrupt();
          
          // Clear any pending barge-in timeout
          if (bargeInTimeoutRef.current) {
            clearTimeout(bargeInTimeoutRef.current);
          }
        }
        break;
        
      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        setIsThinking(true);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        const userText = message.transcript || '';
        setUserTranscript(userText);
        
        if (userText.trim()) {
          const userMessage: VoiceMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userText,
            timestamp: new Date(),
            type: 'audio'
          };
          
          setConversationHistory(prev => [...prev, userMessage]);
        }
        break;
        
      case 'response.audio.delta':
        if (message.delta) {
          audioPlayerRef.current?.enqueuePCM16Base64(message.delta);
        }
        break;
        
      case 'response.text.delta':
        setAssistantTranscript(prev => prev + (message.delta || ''));
        break;
        
      case 'response.text.done':
        const assistantText = message.text || assistantTranscript;
        setAssistantTranscript('');
        
        if (assistantText.trim()) {
          const assistantMessage: VoiceMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: assistantText,
            timestamp: new Date(),
            type: 'text'
          };
          
          setConversationHistory(prev => [...prev, assistantMessage]);
        }
        break;
        
      case 'response.done':
        setIsThinking(false);
        break;
        
      case 'error':
        log("Server error:", message);
        setConnectionError(message.message || 'Server error');
        toast.error(message.message || 'Voice service error');
        break;
        
      default:
        log("Unhandled message type:", message.type);
    }
  }, [log, assistantTranscript]);

  // Start voice mode
  const startVoiceMode = useCallback(async (): Promise<boolean> => {
    try {
      log("Starting voice mode");
      
      // Initialize audio first
      initializeAudio();
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: voiceSettings.echoCancellation,
          noiseSuppression: voiceSettings.noiseSuppression,
          autoGainControl: voiceSettings.autoGainControl,
          sampleRate: 24000,
          channelCount: 1
        }
      });
      
      // Connect WebSocket
      const connected = await connectWebSocket();
      if (!connected) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("Failed to connect to voice service");
      }
      
      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert to PCM16 and send
          const reader = new FileReader();
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64 = bytesToBase64(uint8Array);
            
            wsRef.current?.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64
            }));
          };
          reader.readAsArrayBuffer(event.data);
        }
      };
      
      mediaRecorder.start(100); // 100ms chunks for low latency
      mediaRecorderRef.current = mediaRecorder;
      
      log("Voice mode started successfully");
      return true;
      
    } catch (error) {
      log("Failed to start voice mode:", error);
      setConnectionError((error as Error).message);
      return false;
    }
  }, [initializeAudio, connectWebSocket, voiceSettings, log]);

  // Stop voice mode
  const stopVoiceMode = useCallback(() => {
    log("Stopping voice mode");
    
    // Stop media recorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    
    // Stop audio playback
    audioPlayerRef.current?.stop();
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Reset state
    setIsConnected(false);
    setIsConnecting(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsThinking(false);
    setUserTranscript('');
    setAssistantTranscript('');
    setConnectionError(null);
  }, [log]);

  // Send text message (fallback)
  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Not connected to voice service");
      return;
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    }));
    
    wsRef.current.send(JSON.stringify({
      type: 'response.create'
    }));
    
    // Add to conversation history
    const userMessage: VoiceMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      type: 'text'
    };
    
    setConversationHistory(prev => [...prev, userMessage]);
  }, []);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    setUserTranscript('');
    setAssistantTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceMode();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stopVoiceMode]);

  // Get current status
  const getStatus = useCallback(() => {
    if (!isConnected && connectionError) return 'error';
    if (isConnecting) return 'connecting';
    if (!isConnected) return 'disconnected';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    if (isThinking) return 'thinking';
    return 'ready';
  }, [isConnected, isConnecting, connectionError, isSpeaking, isListening, isThinking]);

  const getStatusMessage = useCallback(() => {
    const status = getStatus();
    switch (status) {
      case 'error': return connectionError || 'Connection error';
      case 'connecting': return 'Connecting to Durmah...';
      case 'disconnected': return 'Ready to connect';
      case 'speaking': return 'Speaking...';
      case 'listening': return 'Listening... speak naturally';
      case 'thinking': return 'Processing...';
      case 'ready': return 'Ready when you are!';
      default: return 'Initializing...';
    }
  }, [getStatus, connectionError]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    
    // Voice state
    isListening,
    isSpeaking,
    isThinking,
    
    // Content
    userTranscript,
    assistantTranscript,
    conversationHistory,
    
    // Settings
    voiceSettings,
    setVoiceSettings,
    
    // Actions
    startVoiceMode,
    stopVoiceMode,
    sendTextMessage,
    clearConversation,
    
    // Status
    getStatus,
    getStatusMessage,
    
    // Session info
    sessionConfig: sessionConfigRef.current
  };
}