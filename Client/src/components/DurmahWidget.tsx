// Client/src/components/DurmahWidget.tsx
import React, { useMemo } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useRealtimeVoice } from "../hooks/useRealtimeVoice";

type Line = { id: string; text: string };

const DurmahWidget: React.FC = () => {
  const {
    status,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    partialTranscript,
    startVoiceMode,
    stopVoiceMode,
  } = useRealtimeVoice();

  const isActive = isConnected && (isListening || isSpeaking);

  const lines: Line[] = useMemo(() => {
    if (Array.isArray(transcript)) return transcript as Line[];
    return [];
  }, [transcript]);

  return (
    <>
      {/* little transcript card */}
      <div className="fixed bottom-28 right-6 w-80 max-h-60 rounded-xl shadow-lg bg-white/95 border border-purple-200 overflow-hidden">
        <div className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold">
          Conversation Transcript
        </div>
        <div className="p-3 text-sm space-y-2 overflow-y-auto" style={{ maxHeight: 160 }}>
          {lines.length > 0 ? (
            lines.map((line, idx) => (
              <div key={line?.id ?? idx} className="p-2 rounded-md bg-gray-100 text-gray-800">
                {line?.text ?? ""}
              </div>
            ))
          ) : (
            <div className="text-gray-400 italic">No conversation yet...</div>
          )}
          {partialTranscript && (
            <div className="p-2 rounded-md bg-yellow-100 text-gray-800">{partialTranscript}</div>
          )}
        </div>
        <div className="px-4 py-2 text-xs text-gray-600 border-t">
          Status: {status}
          {isListening ? " • Listening" : " • Mic idle"}
          {isSpeaking ? " • Speaking" : " • Silent"}
        </div>
      </div>

      {/* mic button */}
      <motion.button
        onClick={isActive ? stopVoiceMode : startVoiceMode}
        whileTap={{ scale: 0.95 }}
        className={clsx(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl grid place-items-center text-white",
          isActive ? "bg-red-500" : "bg-purple-600"
        )}
      >
        {isActive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        {isListening && (
          <span className="absolute inset-0 rounded-full ring-2 ring-white/40 animate-ping" />
        )}
      </motion.button>
    </>
  );
};

export default DurmahWidget;
