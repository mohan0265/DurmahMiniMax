// Client/src/hooks/useRealtimeVoice.js
// Thin wrapper around your (long) useRealtimeWebRTC.js.
// - Always POST to the session endpoint
// - Accepts both {client_secret:{value}} and {token}

import { useState } from "react";
import { useRealtimeWebRTC } from "./useRealtimeWebRTC";

const SESSION_ENDPOINT =
  import.meta.env.VITE_SESSION_ENDPOINT || "/.netlify/functions/realtime-session";

export function useRealtimeVoice() {
  const rtc = useRealtimeWebRTC();
  const [voiceModeActive, setVoiceModeActive] = useState(false);

  const startVoiceMode = async () => {
    try {
      const resp = await fetch(SESSION_ENDPOINT, { method: "POST" });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();

      const token =
        data?.client_secret?.value ||
        data?.token ||
        null;

      const model =
        data?.model ||
        "gpt-4o-realtime-preview-2024-12-17";

      if (!token) throw new Error("No token returned from session endpoint");

      await rtc.connect({ token, model });
      setVoiceModeActive(true);
    } catch (e) {
      console.error("startVoiceMode failed:", e);
      // surfacing via rtc.lastError is handled inside rtc hook already (if you want)
    }
  };

  const stopVoiceMode = () => {
    try {
      rtc.disconnect();
    } finally {
      setVoiceModeActive(false);
    }
  };

  const sendMessage = (text) => rtc.sendText(text);

  return {
    ...rtc,
    voiceModeActive,
    startVoiceMode,
    stopVoiceMode,
    sendMessage,
  };
}
