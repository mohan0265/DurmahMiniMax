// Client/src/hooks/useRealtimeVoice.js
// Small wrapper around the WebRTC hook + audio unlock on user gesture.

import { useCallback, useRef, useState } from "react";
import { useRealtimeWebRTC } from "./useRealtimeWebRTC";

const SESSION_ENDPOINT =
  import.meta.env.VITE_SESSION_ENDPOINT || "/.netlify/functions/realtime-session";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

export function useRealtimeVoice() {
  const {
    status,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    partialTranscript,
    lastError,
    connect: rtConnect,
    disconnect: rtDisconnect,
    sendText,
  } = useRealtimeWebRTC();

  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const cooldownRef = useRef(false);
  const unlockedRef = useRef(false);

  const log = (...a) => { if (DEBUG) console.log("[useRealtimeVoice]", ...a); };

  const unlockAudio = () => {
    if (unlockedRef.current) return;
    try {
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (ACtx) {
        const ctx = new ACtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001; // inaudible blip to unlock
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
        ctx.resume();
      }
    } catch {}
    unlockedRef.current = true;
  };

  const getSession = useCallback(async () => {
    const resp = await fetch(SESSION_ENDPOINT, { method: "POST" });
    if (!resp.ok) throw new Error(`Session endpoint failed: ${await resp.text()}`);
    const json = await resp.json();
    if (!json?.token) throw new Error("No token returned from session endpoint");
    return { token: json.token, model: json.model || "gpt-4o-realtime-preview-2024-12-17" };
  }, []);

  const connect = useCallback(async () => {
    if (cooldownRef.current || status === "connecting" || status === "connected") return;
    try {
      const { token, model } = await getSession();
      await rtConnect({ token, model });
    } catch (e) {
      console.error(e);
      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 1500);
      throw e;
    }
  }, [status, getSession, rtConnect]);

  const startVoiceMode = useCallback(async () => {
    unlockAudio();          // ⟵ critical: ensures autoplay allowed
    if (!isConnected) await connect();
    setVoiceModeActive(true);
    log("voice mode ON");
  }, [isConnected, connect]);

  const stopVoiceMode = useCallback(() => {
    setVoiceModeActive(false);
    try { rtDisconnect(); } catch {}
    log("voice mode OFF");
  }, [rtDisconnect]);

  const sendMessage = useCallback((text) => {
    if (!text || !text.trim()) return;
    sendText(text.trim());
  }, [sendText]);

  return {
    status,
    isConnected,
    isListening,
    isSpeaking,
    voiceModeActive,
    lastError,
    transcript,
    partialTranscript,
    connect,
    startVoiceMode,
    stopVoiceMode,
    sendMessage,
  };
}
