// Client/src/components/DurmahWidget.tsx
// One-button UI + small transcript panel (robust against empty/partial data).

import React, { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useRealtimeVoice } from "../hooks/useRealtimeVoice";

const DurmahWidget: React.FC = () => {
  const [open, setOpen] = useState(true);
  const {
    voiceModeActive,
    startVoiceMode,
    stopVoiceMode,
    transcript,
    partialTranscript,
    status,
    isSpeaking,
  } = useRealtimeVoice();

  const toggle = () => {
    if (voiceModeActive) stopVoiceMode();
    else startVoiceMode();
  };

  const list = Array.isArray(transcript) ? transcript : [];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Mic Button */}
      <button
        onClick={toggle}
        title={voiceModeActive ? "Stop voice" : "Start voice"}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition ${
          voiceModeActive ? "bg-red-500 hover:bg-red-600" : "bg-purple-600 hover:bg-purple-700"
        }`}
      >
        {voiceModeActive ? (
          <MicOff className="text-white w-8 h-8" />
        ) : (
          <Mic className="text-white w-8 h-8" />
        )}
      </button>

      {/* Transcript Panel */}
      {open && (
        <div className="mt-3 w-80 bg-white/95 backdrop-blur rounded-xl border border-gray-200 shadow-xl p-3">
          <div className="font-semibold text-purple-700">Conversation Transcript</div>
          <div className="h-40 overflow-y-auto mt-2 space-y-1">
            {list.length > 0 ? (
              list.map((line: any, idx: number) => (
                <div key={line?.id ?? idx} className="p-2 rounded-md bg-gray-100 text-sm">
                  {line?.text ?? ""}
                </div>
              ))
            ) : (
              <div className="text-gray-400 italic text-center text-sm">
                No conversation yet...
              </div>
            )}
            {partialTranscript && (
              <div className="p-2 rounded-md bg-yellow-100 text-sm">{partialTranscript}</div>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Status: {status || "idle"} {isSpeaking ? "• Speaking" : ""}
          </div>
        </div>
      )}
    </div>
  );
};

export default DurmahWidget;
