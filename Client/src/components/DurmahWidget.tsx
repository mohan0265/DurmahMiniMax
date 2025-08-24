// Client/src/components/DurmahWidget.tsx
// Floating voice widget with full UI: start/stop, status badges, transcript pane,
// text input fallback, keyboard toggle (Ctrl/Cmd + V), and subtle animations.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  Bot,
  X,
  Send,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { useRealtimeVoice } from "../hooks/useRealtimeVoice";

type Props = {
  startOpen?: boolean;
  title?: string;
};

const kbd = (e: KeyboardEvent) =>
  (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "v");

const Badge = ({ color, children }: { color: "green" | "blue" | "red" | "amber"; children: React.ReactNode }) => {
  const map: Record<string, string> = {
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${map[color]} whitespace-nowrap`}>
      {children}
    </span>
  );
};

const Dot = ({ active }: { active: boolean }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
  />
);

const bubbleVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

const containerVariants = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.98 },
};

const inputVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

function useKeyboardToggle(onToggle: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (kbd(e)) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggle]);
}

export default function DurmahWidget({ startOpen = false, title = "Durmah Voice" }: Props) {
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
    sendMessage,
  } = useRealtimeVoice();

  const [open, setOpen] = useState(startOpen);
  const [expanded, setExpanded] = useState(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, partialTranscript]);

  const connectedLabel = useMemo(() => {
    if (status === "connecting") return "Connecting…";
    if (status === "connected") return "Connected";
    return "Offline";
  }, [status]);

  const onToggleVoice = useCallback(async () => {
    if (!voiceModeActive) {
      await startVoiceMode();
      setOpen(true);
    } else {
      stopVoiceMode();
    }
  }, [voiceModeActive, startVoiceMode, stopVoiceMode]);

  const onSend = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    sendMessage(t);
    setInput("");
  }, [input, sendMessage]);

  useKeyboardToggle(onToggleVoice);

  // One-click connect (useful if user opens panel before talking)
  const handleConnectOnly = useCallback(async () => {
    if (!isConnected) await connect();
  }, [isConnected, connect]);

  return (
    <>
      {/* Floating Button */}
      <div className="fixed right-4 bottom-4 z-[1000]">
        <div className="flex items-center gap-3 mb-2">
          <Badge color={isConnected ? "green" : status === "connecting" ? "amber" : "red"}>
            <div className="flex items-center gap-1">
              <Dot active={isConnected} />
              <span>{connectedLabel}</span>
            </div>
          </Badge>
          <Badge color={isListening ? "blue" : "amber"}>
            {isListening ? "Listening" : "Mic idle"}
          </Badge>
          <Badge color={isSpeaking ? "blue" : "amber"}>
            {isSpeaking ? "Speaking" : "Silent"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-3 rounded-full shadow-lg bg-white hover:bg-gray-50 border border-gray-200"
            aria-label={open ? "Close widget" : "Open widget"}
            title={open ? "Close" : "Open"}
          >
            {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
          </button>

          <button
            onClick={onToggleVoice}
            className={`p-3 rounded-full shadow-lg border ${
              voiceModeActive ? "bg-red-600 text-white border-red-700" : "bg-green-600 text-white border-green-700"
            }`}
            aria-label={voiceModeActive ? "Stop voice" : "Start voice"}
            title={voiceModeActive ? "Stop (Ctrl/Cmd+V)" : "Start (Ctrl/Cmd+V)"}
          >
            {voiceModeActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {!isConnected && (
            <button
              onClick={handleConnectOnly}
              className="p-3 rounded-full shadow-lg bg-white hover:bg-gray-50 border border-gray-200"
              title="Prepare connection (optional)"
            >
              <Loader2 className={`w-5 h-5 ${status === "connecting" ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={containerVariants}
            className="fixed bottom-20 right-4 z-[999] w-[380px] max-h-[70vh] rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                <span className="text-[11px] text-gray-500">• {connectedLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  title={expanded ? "Collapse" : "Expand"}
                >
                  {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-md hover:bg-gray-100"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="content"
                  initial="initial"
                  animate="animate"
                  exit="initial"
                  variants={bubbleVariants}
                  className="flex-1 flex flex-col"
                >
                  {/* Status strip */}
                  <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-600 bg-white/60 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Mic className={`w-4 h-4 ${isListening ? "text-blue-600" : "text-gray-400"}`} />
                        {isListening ? "Listening" : "Mic idle"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Volume2 className={`w-4 h-4 ${isSpeaking ? "text-blue-600" : "text-gray-400"}`} />
                        {isSpeaking ? "Speaking" : "Silent"}
                      </span>
                      <span className="ml-auto">
                        {status === "connecting" ? (
                          <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> connecting…</span>
                        ) : (
                          <span className="text-gray-500">Ctrl/Cmd + V to toggle</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Transcript */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                    {(!transcript || transcript.length === 0) && !partialTranscript && (
                      <p className="text-xs text-gray-500">
                        Start speaking or type below. Your assistant will reply with voice. 
                      </p>
                    )}

                    {(transcript as any[]).map((t: any, idx: number) => (
                      <motion.div
                        key={t?.id ?? idx}
                        initial="initial"
                        animate="animate"
                        variants={bubbleVariants}
                        className="max-w-[90%] rounded-xl px-3 py-2 bg-gray-100 text-gray-800 text-sm"
                      >
                        {String(t?.text ?? "")}
                      </motion.div>
                    ))}

                    {!!partialTranscript && (
                      <div className="max-w-[90%] rounded-xl px-3 py-2 bg-indigo-50 text-indigo-900 text-sm border border-indigo-200">
                        {partialTranscript}
                      </div>
                    )}

                    {!!lastError && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {lastError}
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <motion.div
                    initial="initial"
                    animate="animate"
                    variants={inputVariants}
                    className="border-t border-gray-200 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
                        placeholder="Type a message…"
                        className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={onSend}
                        className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                        title="Send"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
