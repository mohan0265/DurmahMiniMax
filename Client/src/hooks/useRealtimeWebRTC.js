// [GEMINI PATCH] Fixed by Gemini on 25 Aug for full-duplex voice
import { useCallback, useRef, useState, useEffect } from "react";
import toast from 'react-hot-toast';

// [GEMINI PATCH] Correctly derive WebSocket URL from Vite env vars
function getVoiceWebSocketEndpoint() {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) return wsUrl;

  const sessionEndpoint = import.meta.env.VITE_SESSION_ENDPOINT;
  if (sessionEndpoint) return sessionEndpoint.replace(/^http/, 'ws');

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  return `${apiUrl.replace(/^http/, 'ws')}/voice`;
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

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const remoteAudioRef = useRef(new Audio());

  const addMessage = useCallback((sender, text, type = 'text') => {
    const message = {
      id: Date.now() + Math.random(),
      sender,
      text,
      type,
      timestamp: new Date().toISOString()
    };
    setConversationHistory(prev => [...prev, message]);
  }, []);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return true;
    
    setError(null);
    setIsConnecting(true);

    try {
      const wsEndpoint = getVoiceWebSocketEndpoint();
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        toast.success("Voice connected!");
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'audio_chunk') {
          const audioBlob = new Blob([new Uint8Array(atob(message.pcm16).split("").map(c => c.charCodeAt(0)))], { type: 'audio/pcm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          remoteAudioRef.current.src = audioUrl;
          remoteAudioRef.current.play().catch(e => console.error("Audio playback failed", e));
        } else if (message.type === 'transcript') {
          if (message.is_partial) {
            setPartialTranscript(message.text);
          } else {
            setPartialTranscript("");
            addMessage('durmah', message.text, 'voice');
          }
        } else if (message.type === 'durmah.ready') {
            setIsThinking(false);
        } else if (message.type === 'response.done') {
            setIsThinking(false);
            setIsSpeaking(false);
        } else if (message.type === 'input_audio_buffer.speech_started') {
            setIsListening(true);
        } else if (message.type === 'input_audio_buffer.speech_stopped') {
            setIsListening(false);
            setIsThinking(true);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onerror = (err) => {
        setError("WebSocket error");
        setIsConnected(false);
        setIsConnecting(false);
        toast.error("Voice connection failed.");
      };

    } catch (e) {
      setError(e.message);
      setIsConnecting(false);
      return false;
    }
    return true;
  }, [isConnecting, isConnected, addMessage]);

  const startVoiceMode = useCallback(async () => {
    if (!isConnected) {
      await connect();
    }
    setVoiceModeActive(true);
    setIsListening(true);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
            }
            const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pcm16.buffer)));
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }));
            }
        };
        source.connect(processor);
        processor.connect(audioContextRef.current.destination);
        audioProcessorRef.current = { source, processor };
    } catch (err) {
        setError("Microphone access denied.");
        toast.error("Please allow microphone access.");
        setIsListening(false);
        setVoiceModeActive(false);
    }
  }, [isConnected, connect]);

  const stopVoiceMode = useCallback(() => {
    setIsListening(false);
    if (audioProcessorRef.current) {
        audioProcessorRef.current.source.disconnect();
        audioProcessorRef.current.processor.disconnect();
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        wsRef.current.send(JSON.stringify({ type: 'response.create' }));
        setIsThinking(true);
    }
  }, []);

  const sendTextMessage = useCallback((text) => {
    if (voiceModeActive) {
        stopVoiceMode();
    }
    addMessage('user', text, 'text');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }]}}));
        wsRef.current.send(JSON.stringify({ type: 'response.create' }));
        setIsThinking(true);
    }
  }, [voiceModeActive, stopVoiceMode, addMessage]);

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
    connect,
    startVoiceMode,
    stopVoiceMode,
    sendTextMessage,
  };
}
