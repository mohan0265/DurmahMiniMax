// Client/src/hooks/useRealtimeVoice.js
// High-level voice manager wrapping the WebRTC helper.
// Uses VITE_SESSION_ENDPOINT to fetch an ephemeral Realtime token,
// then connects via useRealtimeWebRTC. No TypeScript types here.

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [cooldown, setCooldown] = useState(false);
  const tokenRef = useRef(null);
  const modelRef = useRef(null);

  const log = (...args) => {
    if (DEBUG) console.log("[useRealtimeVoice]", ...args);
  };

  const getSession = useCallback(async () => {
    const resp = await fetch(SESSION_ENDPOINT, { method: "POST" });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Session endpoint failed: ${text}`);
    }
    const json = await resp.json();
    if (!json || !json.token) throw new Error("No token returned from session endpoint");
    tokenRef.current = json.token;
    modelRef.current = json.model || "gpt-4o-realtime-preview-2024-12-17";
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
      // brief cooldown to avoid hammering
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);
      throw e;
    }
  }, [cooldown, status, getSession, rtConnect]);

  const startVoiceMode = useCallback(async () => {
    if (!isConnected) {
      await connect();
    }
    setVoiceModeActive(true);
  }, [isConnected, connect]);

  const stopVoiceMode = useCallback(() => {
    setVoiceModeActive(false);
    rtDisconnect();
  }, [rtDisconnect]);

  const sendMessage = useCallback(
    (text) => {
      const t = (text || "").trim();
      if (!t) return;
      sendText(t);
    },
    [sendText]
  );

  // Optional: try reconnecting when tab becomes visible again
  useEffect(() => {
    if (!voiceModeActive) return;
    const handleVis = async () => {
      if (document.visibilityState === "visible" && !isConnected) {
        try {
          await connect();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => document.removeEventListener("visibilitychange", handleVis);
  }, [voiceModeActive, isConnected, connect]);

  return {
    isConnected,
    isListening,
    isSpeaking,
    voiceModeActive,
    status,
    lastError,
    transcript,
    partialTranscript,
    connect,
    startVoiceMode,
    stopVoiceMode,
    sendMessage,
  };
}
