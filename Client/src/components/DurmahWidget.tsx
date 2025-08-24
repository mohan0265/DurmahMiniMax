// Client/src/components/DurmahWidget.tsx
// Minimal "ChatGPT-style" voice widget: ONE floating button.
// Tap = start voice mode (mic on, TTS via WebRTC).
// Tap again = stop. Optional tiny transcript toast while active.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useRealtimeVoice } from "../hooks/useRealtimeVoice";

type TranscriptItem = { id?: string; text?: string };

export default function DurmahWidget() {
  const {
    isConnected,
    isListening,
    isSpeaking,
    voiceModeActive,
    status,
    lastError,
    transcript,
    partialTranscript,
    startVoiceMode,
    stopVoiceMode,
    connect,
    sendMessage, // still available if you ever need a programmatic prompt
  } = useRealtimeVoice();

  // show a tiny bubble with last line while active (no full panel)
  const [toastOpen, setToastOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  // compute a short status ring
  const ringClass = useMemo(() => {
    if (voiceModeActive && (isListening || isSpeaking)) return "animate-ping";
    return "";
  }, [voiceModeActive, isListening, isSpeaking]);

  const onToggle = useCallback(async () => {
    try {
      if (!voiceModeActive) {
        if (!isConnected) await connect();
        await startVoiceMode();
        setToastOpen(true);
      } else {
        stopVoiceMode();
        setToastOpen(false);
      }
    } catch (e) {
      // keep silent; the button should remain simple
      console.error(e);
    }
  }, [voiceModeActive, isConnected, connect, startVoiceMode, stopVoiceMode]);

  // Ctrl/Cmd + V also toggles voice
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onToggle]);

  // Auto-hide the toast a few seconds after updates (keeps UI clean)
  const lastLine: string = useMemo(() => {
    const arr = (transcript as unknown as TranscriptItem[]) || [];
    const finalText = arr.length ? String(arr[arr.length - 1]?.text ?? "") : "";
    return partialTranscript || finalText;
  }, [transcript, partialTranscript]);

  useEffect(() => {
    if (!toastOpen) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastOpen(false), 3500);
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    };
  }, [lastLine, toastOpen]);

  // a concise accessible label
  const label = voiceModeActive
    ? "Stop voice (tap to end)"
    : status === "connecting"
    ? "Connecting…"
    : "Start voice (tap to speak)";

  return (
    <>
      {/* ONE floating button */}
      <button
        onClick={onToggle}
        aria-label={label}
        title={label}
        className={`
          fixed right-5 bottom-5 z-[1000]
          h-16 w-16 rounded-full
          flex items-center justify-center
          shadow-xl border
          transition-transform active:scale-95
          ${voiceModeActive ? "bg-red-600 border-red-700 text-white" : "bg-indigo-600 border-indigo-700 text-white"}
        `}
      >
        {/* soft animated ring when actively listening/speaking */}
        <span
          className={`
            absolute inline-block rounded-full
            h-20 w-20 ${ringClass}
            ${voiceModeActive ? "bg-white/20" : "bg-white/10"}
          `}
          style={{ pointerEvents: "none" }}
        />
        {voiceModeActive ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
      </button>

      {/* Tiny transcript toast while active (auto-hides) */}
      <AnimatePresence>
        {voiceModeActive && toastOpen && !!lastLine && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="fixed right-5 bottom-24 z-[999] max-w-[70vw] sm:max-w-sm
                       bg-white/95 backdrop-blur border border-gray-200 shadow-xl
                       rounded-2xl px-3 py-2 text-sm text-gray-800"
          >
            {lastError ? (
              <span className="text-red-700">{lastError}</span>
            ) : (
              <span className="line-clamp-3">{lastLine}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
