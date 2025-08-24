// Client/src/components/DurmahWidget.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useRealtimeWebRTC } from "../hooks/useRealtimeWebRTC";

// Define transcript line type
type TranscriptLine = {
  id: string;
  text: string;
};

const DurmahWidget: React.FC = () => {
  const [open, setOpen] = useState(true); // keep widget visible
  const {
    status,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    partialTranscript,
    connect,
    disconnect,
  } = useRealtimeWebRTC();

  const toggleVoice = async () => {
    if (isConnected) {
      disconnect();
    } else {
      const tokenResp = await fetch("/.netlify/functions/realtime-session");
      const { client_secret, model } = await tokenResp.json();
      await connect({ token: client_secret.value, model });
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={toggleVoice}
        className={`fixed bottom-6 right-6 flex items-center justify-center w-16 h-16 rounded-full shadow-lg focus:outline-none ${
          isConnected ? "bg-red-500" : "bg-purple-600"
        }`}
        animate={{ scale: isSpeaking ? 1.1 : 1 }}
        transition={{
          duration: 0.3,
          repeat: isSpeaking ? Infinity : 0,
          repeatType: "reverse",
        }}
      >
        {isConnected ? (
          <MicOff className="text-white w-8 h-8" />
        ) : (
          <Mic className="text-white w-8 h-8" />
        )}
      </motion.button>

      {/* Transcript Box */}
      {open && (
        <div className="fixed bottom-28 right-6 w-80 max-h-96 bg-white shadow-xl rounded-lg border border-gray-200 flex flex-col">
          <div className="px-4 py-2 bg-purple-600 text-white rounded-t-lg text-sm font-semibold">
            Conversation Transcript
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-sm space-y-2">
            {(transcript as TranscriptLine[]).map((line, idx) => (
              <div
                key={line.id || idx}
                className="p-2 rounded-md bg-gray-100 text-gray-800"
              >
                {line.text}
              </div>
            ))}
            {partialTranscript && (
              <div className="p-2 rounded-md bg-yellow-100 text-gray-700 italic">
                {partialTranscript}
              </div>
            )}
            {transcript.length === 0 && !partialTranscript && (
              <div className="text-gray-400 italic text-center">
                No conversation yet...
              </div>
            )}
          </div>
          <div className="px-3 py-2 border-t text-xs text-gray-500">
            Status: {status} {isListening ? "🎤 Listening" : ""}{" "}
            {isSpeaking ? "🗣️ Speaking" : ""}
          </div>
        </div>
      )}
    </>
  );
};

export default DurmahWidget;
