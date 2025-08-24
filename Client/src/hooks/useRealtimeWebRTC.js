// Client/src/hooks/useRealtimeWebRTC.js
import { useCallback, useRef, useState } from "react";

/**
 * WebRTC hook for OpenAI Realtime via our Render proxy.
 * - Creates RTCPeerConnection
 * - Captures mic
 * - Sends SDP offer to backend: VITE_SESSION_ENDPOINT (ABSOLUTE URL)
 * - Backend forwards to OpenAI; returns SDP answer (application/sdp)
 * - setRemoteDescription(answer) and play remote audio
 */

function getAbsoluteEndpoint() {
  const v = (import.meta?.env?.VITE_SESSION_ENDPOINT || "").trim();
  if (!/^https?:\/\//i.test(v)) {
    const msg = `[Durmah][FATAL] VITE_SESSION_ENDPOINT must be absolute, got "${v}"`;
    console.error(msg);
    throw new Error(msg);
  }
  return v;
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
  
  // Voice settings (for compatibility)
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

  // Status utilities
  const getStatus = () => {
    if (!isConnected && !isConnecting) return 'disconnected';
    if (isConnecting) return 'connecting';
    if (error) return 'error';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    if (isThinking) return 'thinking';
    return 'ready';
  };
  
  const getStatusMessage = () => {
    if (error) return `Error: ${error}`;
    if (isConnecting) return 'Connecting to Durmah...';
    if (!isConnected) return 'Click to connect';
    if (isSpeaking) return 'Durmah is speaking...';
    if (isListening) return 'Listening... speak naturally';
    if (isThinking) return 'Thinking about your question...';
    return 'Ready! Click to speak or type below.';
  };

  // Add message to conversation history
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
    
    const endpoint = getAbsoluteEndpoint();
    console.log("[RTC] connect → endpoint", endpoint);

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log("[RTC] state:", pc.connectionState);
        setIsConnected(pc.connectionState === "connected");
      };

      pc.ontrack = (ev) => {
        console.log("[RTC] remote track");
        if (remoteAudioRef.current && ev.streams[0]) {
          remoteAudioRef.current.srcObject = ev.streams[0];
          remoteAudioRef.current
            .play()
            .catch((e) => console.warn("autoplay blocked", e));
        }
      };

      // Send/recv audio
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // Mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));
      console.log("[RTC] mic tracks:", mic.getAudioTracks().length);

      // Offer → backend → OpenAI → Answer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`SDP exchange failed: ${res.status} ${txt}`);
      }
      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      console.log("[RTC] connected (SDP answered)");
      setIsConnected(true);
      setIsConnecting(false);
      
      addMessage('durmah', 'Connected! I can hear you now. How can I help with your legal studies?', 'voice');
      
      return true;
    } catch (e) {
      console.error("[RTC] connect failed", e);
      setError(e.message || String(e));
      setIsConnected(false);
      setIsConnecting(false);
      throw e;
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
    if (!isConnected) await connect();
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

  // Send text message (fallback when not in voice mode)
  const sendTextMessage = useCallback((text) => {
    if (!text.trim()) return;
    
    // Add user message
    addMessage('user', text, 'text');
    
    // Simulate AI response
    setTimeout(() => {
      addMessage('durmah', `I received your message: "${text}". This is a simulated text response. Try voice mode for real-time conversation!`, 'text');
    }, 500);
  }, []);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    console.log('[RTC] conversation cleared');
  }, []);

  return {
    // Connection state
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    isThinking,
    voiceModeActive,
    
    // Data
    conversationHistory,
    error,
    connectionError: error, // Alias for error
    voiceSettings,
    
    // Actions  
    connect,
    disconnect,
    startVoiceMode,
    stopVoiceMode,
    sendTextMessage,
    clearConversation,
    setVoiceSettings,
    
    // Utilities
    getStatus,
    getStatusMessage
  };
}