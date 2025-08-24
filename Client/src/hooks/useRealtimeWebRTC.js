// [GEMINI PATCH] Inserted by Gemini on 25 Aug for mic initialization and endpoint debugging
import { useCallback, useRef, useState } from "react";
import toast from 'react-hot-toast';

// [GEMINI PATCH] Added console.log to debug Vite environment variable injection.
console.log("[Debug] VITE_SESSION_ENDPOINT at runtime:", import.meta.env.VITE_SESSION_ENDPOINT);

function getAbsoluteEndpoint() {
  const endpoint = import.meta.env.VITE_SESSION_ENDPOINT;

  if (!endpoint || !endpoint.startsWith("http")) {
    console.error("[Durmah][FATAL] VITE_SESSION_ENDPOINT is not valid:", endpoint);
    toast.error("Voice mode unavailable. Please try again later.");
    throw new Error("VITE_SESSION_ENDPOINT is not a valid absolute URL.");
  }
  
  return endpoint;
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
  
  const [voiceSettings, setVoiceSettings] = useState({
    inputGain: 1.0,
    outputVolume: 1.0,
    echoCancellation: true,
    noiseSuppression: true
  });

  const pcRef = useRef(null);
  const micRef = useRef(null);
  const remoteAudioRef = useRef(typeof Audio !== "undefined" ? new Audio() : null);

  if (remoteAudioRef.current) {
    remoteAudioRef.current.autoplay = true;
    remoteAudioRef.current.playsInline = true;
  }

  const addMessage = (sender, text, type = 'text') => {
    const message = {
      id: Date.now() + Math.random(),
      sender,
      text,
      type,
      timestamp: new Date().toISOString()
    };
    setConversationHistory(prev => [...prev, message]);
  };

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return true;
    
    setError(null);
    setIsConnecting(true);
    console.log("[Durmah] Attempting to connect...");

    try {
      const endpoint = getAbsoluteEndpoint();
      console.log("[RTC] connect → endpoint", endpoint);

      console.log("[Durmah] Requesting microphone permission...");
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[Durmah] Microphone access granted.");
      micRef.current = micStream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log("[RTC] state:", pc.connectionState);
        setIsConnected(pc.connectionState === "connected");
        if (pc.connectionState === 'failed') {
            setError("WebRTC connection failed.");
            toast.error("Connection failed. Please try again.");
        }
      };

      pc.ontrack = (ev) => {
        console.log("[RTC] remote track received");
        if (remoteAudioRef.current && ev.streams && ev.streams[0]) {
          remoteAudioRef.current.srcObject = ev.streams[0];
          remoteAudioRef.current.play().catch(e => console.warn("[Durmah] Autoplay was blocked by browser", e));
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        if (channel.label === "transcript") {
          channel.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'partial') {
              setPartialTranscript(data.transcript);
            } else if (data.type === 'final') {
              setPartialTranscript("");
              addMessage('durmah', data.transcript, 'voice');
            }
          };
        }
      };

      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));
      console.log("[RTC] mic tracks added to peer connection.");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Server error with no message");
        throw new Error(`SDP exchange failed: ${res.status} ${txt}`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      console.log("[RTC] Connected successfully (SDP answer received).");
      setIsConnected(true);
      addMessage('durmah', 'Connected! I can hear you now. How can I help with your legal studies?', 'voice');
      return true;

    } catch (e) {
      console.error("[Durmah] Connection or microphone access failed:", e);
      setError(e.message || String(e));
      toast.error("Microphone access denied or not supported in this browser.");
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected]);

  const disconnect = useCallback(async () => {
    try {
      console.log("[RTC] disconnecting");
      setVoiceModeActive(false);
      setIsListening(false);
      setIsSpeaking(false);
      setIsThinking(false);
      
      if (pcRef.current) { 
        pcRef.current.close(); 
        pcRef.current = null; 
      }
      if (micRef.current) { 
        micRef.current.getTracks().forEach((t) => t.stop()); 
        micRef.current = null; 
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
      
      setIsConnected(false);
      setIsConnecting(false);
      setError(null);
      
      addMessage('durmah', 'Disconnected. Click to reconnect anytime!', 'text');
    } catch (e) {
      console.warn("[RTC] disconnect error", e);
    }
  }, []);

  const startVoiceMode = useCallback(async () => {
    if (!isConnected) {
        const connected = await connect();
        if (!connected) {
            setVoiceModeActive(false);
            return false;
        }
    }
    console.log("[RTC] starting voice mode");
    setIsListening(true);
    setVoiceModeActive(true);
    return true;
  }, [isConnected, connect]);

  const stopVoiceMode = useCallback(async () => {
    console.log("[RTC] stopping voice mode");
    setIsListening(false);
    setVoiceModeActive(false);
    addMessage('durmah', 'Voice mode stopped. You can start again anytime!', 'text');
  }, []);

  const sendTextMessage = useCallback((text) => {
    if (!text.trim()) return;
    addMessage('user', text, 'text');
    setTimeout(() => {
      addMessage('durmah', `I received your message: "${text}". This is a simulated text response. Try voice mode for real-time conversation!`, 'text');
    }, 500);
  }, []);

  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    console.log('[RTC] conversation cleared');
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
