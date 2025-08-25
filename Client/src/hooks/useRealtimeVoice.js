// Client/src/hooks/useRealtimeVoice.js
import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeWebRTC } from "./useRealtimeWebRTC";

const SESSION_ENDPOINT = import.meta.env.VITE_SESSION_ENDPOINT || "/.netlify/functions/realtime-session";
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
  const [cooldown, setCooldown] = useState(false);
  const tokenRef = useRef(null);
  const modelRef = useRef(null);

  const log = (...a) => { if (DEBUG) console.log("[useRealtimeVoice]", ...a); };

  const getSession = useCallback(async () => {
    const r = await fetch(SESSION_ENDPOINT, { method: "POST" });
    if (!r.ok) throw new Error(`Session endpoint failed: ${await r.text()}`);
    const j = await r.json();
    if (!j?.token) throw new Error("No token returned from session endpoint");
    tokenRef.current = j.token;
    modelRef.current = j.model || "gpt-4o-realtime-preview-2024-12-17";
    return { token: tokenRef.current, model: modelRef.current };
  }, []);

  const connect = useCallback(async () => {
    if (cooldown || status === "connecting" || status === "connected") return;
    try {
      const { token, model } = await getSession();
      await rtConnect({ token, model });
      log("connected");
    } catch (e) {
      console.error(e);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);
      throw e;
    }
  }, [cooldown, status, getSession, rtConnect]);

  const startVoiceMode = useCallback(async () => {
    if (!isConnected) await connect();
    setVoiceModeActive(true);
  }, [isConnected, connect]);

  const stopVoiceMode = useCallback(() => {
    setVoiceModeActive(false);
    rtDisconnect();
  }, [rtDisconnect]);

  const sendMessage = useCallback((text) => {
    if (!text || !text.trim()) return;
    sendText(text.trim());
  }, [sendText]);

  useEffect(() => {
    if (!voiceModeActive) return;
    const onVis = async () => {
      if (document.visibilityState === "visible" && !isConnected) {
        try { await connect(); } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [voiceModeActive, isConnected, connect]);

  return {
    isConnected, isListening, isSpeaking,
    voiceModeActive, status, lastError,
    transcript, partialTranscript,
    connect, startVoiceMode, stopVoiceMode, sendMessage,
  };
}
