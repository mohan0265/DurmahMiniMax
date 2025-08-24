import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useRealtimeVoice } from "../hooks/useRealtimeVoice";

// SAFE shape for a transcript line (loose so it never crashes)
type Line = { id?: string; text?: string };

/**
 * Minimal, ChatGPT-style floating mic + small transcript box.
 * - No direct calls to realtime-session here (the hook handles it).
 * - No `.value` reads anywhere.
 * - No TypeScript "never" errors (we coerce transcript to Line[]).
 */
const DurmahWidget: React.FC = () => {
  const {
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    partialTranscript,
    lastError,
    startVoiceMode,
    stopVoiceMode,
  } = useRealtimeVoice();

  // Coerce whatever we get into a safe Line[] so TS won't infer `never`
  const lines: Line[] = useMemo(() => {
    if (!Array.isArray(transcript)) return [];
    // normalize: strings -> { text }, objects keep id/text if present
    return transcript.map((t: any) =>
      typeof t === "string" ? { text: t } : (t as Line)
    );
  }, [transcript]);

  const toggleVoice = async () => {
    if (isConnected) {
      stopVoiceMode();
    } else {
      await startVoiceMode();
    }
  };

  return (
    <>
      {/* Floating Mic Button */}
      <motion.button
        onClick={toggleVoice}
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition ${
          isConnected ? "bg-red-500" : "bg-purple-600"
        }`}
        whileTap={{ scale: 0.92 }}
        animate={{ scale: isSpeaking ? 1.1 : 1.0 }}
        transition={{ duration: 0.25, repeat: isSpeaking ? Infinity : 0, repeatType: "reverse" }}
        aria-label={isConnected ? "Stop voice" : "Start voice"}
      >
        {isConnected ? (
          <MicOff className="text-white w-8 h-8" />
        ) : (
          <Mic className="text-white w-8 h-8" />
        )}
      </motion.button>

      {/* Transcript Box */}
      <div className="fixed bottom-28 right-6 w-80 max-h-96 bg-white shadow-lg rounded-md border border-gray-200 flex flex-col">
        <div className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-t-md">
          Conversation Transcript
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-sm space-y-2">
          {lines.length > 0 ? (
            lines.map((line, idx) => (
              <div
                key={line?.id ?? idx}
                className="p-2 rounded-md bg-gray-100 text-gray-800"
              >
                {line?.text ?? ""}
              </div>
            ))
          ) : (
            <div className="text-gray-400 italic text-center">
              No conversation yet...
            </div>
          )}

          {!!partialTranscript && (
            <div className="p-2 rounded-md bg-yellow-100 text-gray-800">
              {partialTranscript}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t text-xs text-gray-600">
          Status: {isConnected ? "Connected" : "Idle"} •{" "}
          {isListening ? "🎤 Listening" : "Mic idle"} •{" "}
          {isSpeaking ? "🗣️ Speaking" : "Silent"}
        </div>

        {lastError && (
          <div className="px-4 py-2 border-t text-xs text-red-600">
            Error: {lastError}
          </div>
        )}
      </div>
    </>
  );
};

export default DurmahWidget;
