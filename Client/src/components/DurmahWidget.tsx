// Client/src/components/DurmahWidget.tsx
// One-button voice widget with live transcript and post-chat actions,
// now including "Save to cloud" (Supabase, RLS-protected by user_id).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeVoice } from "../hooks/useRealtimeVoice";
import { supabase } from "../lib/supabaseClient";

type Line = { id: string; text: string };

const fmtTime = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export default function DurmahWidget() {
  const {
    status,
    isConnected,
    isListening,
    isSpeaking,
    voiceModeActive,
    transcript,
    partialTranscript,
    connect,
    startVoiceMode,
    stopVoiceMode,
    sendMessage,
    lastError,
  } = useRealtimeVoice();

  // Track a session's approximate start time (for metadata)
  const sessionStartRef = useRef<string | null>(null);

  // Local copy for post-chat actions
  const [localTranscript, setLocalTranscript] = useState<Line[]>([]);
  useEffect(() => {
    setLocalTranscript(Array.isArray(transcript) ? (transcript as Line[]) : []);
  }, [transcript]);

  const [showActions, setShowActions] = useState(false);
  useEffect(() => {
    if (!voiceModeActive && (localTranscript?.length ?? 0) > 0) {
      setShowActions(true);
    }
  }, [voiceModeActive, localTranscript]);

  const joinedText = useMemo(() => {
    const lines = Array.isArray(localTranscript) ? localTranscript : [];
    return lines.map((l) => (l?.text ?? "").trim()).filter(Boolean).join("\n");
  }, [localTranscript]);

  // --- Actions: save, copy, delete, save to cloud ---
  const handleSaveTxt = () => {
    const content = joinedText || "(empty conversation)";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = fmtTime();
    a.href = url;
    a.download = `durmah-transcript-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch {}
      a.remove();
    }, 0);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinedText || "");
    } catch {}
  };

  const handleDeleteLocal = () => {
    setLocalTranscript([]);
    setShowActions(false);
  };

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSaveCloud = async () => {
    setSaveMsg(null);
    if (!joinedText.trim()) {
      setSaveMsg("Nothing to save.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setSaveMsg("Please sign in to save notes.");
        setSaving(false);
        return;
      }

      const payload = {
        user_id: user.id,
        transcript: joinedText,
        started_at: sessionStartRef.current ?? new Date().toISOString(),
        ended_at: new Date().toISOString(),
        meta: {
          source: "voice",
          status,
          // add anything helpful here (model, latency, etc.)
        },
      };

      const { data, error } = await supabase
        .from("voice_conversations")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;
      setSaveMsg("Saved to cloud ✅");
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  // --- Toggle voice ---
  const toggleVoice = async () => {
    if (!isConnected) {
      await connect().catch(() => {});
    }
    if (voiceModeActive) {
      stopVoiceMode();
    } else {
      setShowActions(false);
      sessionStartRef.current = new Date().toISOString();
      await startVoiceMode().catch(() => {});
    }
  };

  const bubbleStatus = React.useMemo(() => {
    if (!isConnected) return "Offline";
    if (isSpeaking) return "Speaking";
    if (isListening) return "Listening";
    return "Connected";
  }, [isConnected, isListening, isSpeaking]);

  return (
    <>
      {/* Floating Mic Button */}
      <button
        onClick={toggleVoice}
        title={voiceModeActive ? "End voice chat" : "Start voice chat"}
        className={`fixed right-6 bottom-6 z-50 rounded-full w-14 h-14 shadow-xl transition
          ${voiceModeActive ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}
          text-white flex items-center justify-center`}
        aria-label="Toggle voice"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
      </button>

      {/* Live mini transcript box */}
      <div className="fixed left-6 bottom-6 z-40 w-[320px] max-w-[90vw]">
        <div className="rounded-xl bg-white/95 backdrop-blur shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 text-white bg-purple-600 text-sm font-semibold">
            Conversation Transcript
          </div>

          <div className="max-h-40 overflow-y-auto px-3 py-2 text-[13px] space-y-2">
            {Array.isArray(transcript) && transcript.length > 0 ? (
              (transcript as Line[]).map((line, idx) => (
                <div
                  key={line?.id ?? idx}
                  className="bg-gray-100 rounded-md px-2 py-1 text-gray-800"
                >
                  {String(line?.text ?? "")}
                </div>
              ))
            ) : (
              <div className="italic text-gray-400">No conversation yet...</div>
            )}

            {!!partialTranscript && (
              <div className="bg-yellow-100 rounded-md px-2 py-1 text-gray-800">
                {partialTranscript}
              </div>
            )}
          </div>

          <div className="px-3 py-2 text-[12px] text-gray-500 flex items-center gap-2 border-t">
            <span className="inline-flex items-center gap-1">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isSpeaking
                    ? "bg-fuchsia-500"
                    : isListening
                    ? "bg-emerald-500"
                    : isConnected
                    ? "bg-sky-500"
                    : "bg-gray-300"
                }`}
              />
              {bubbleStatus}
            </span>
            {lastError && (
              <span className="text-red-500 truncate" title={lastError}>
                • {lastError}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* After-chat actions tray */}
      {showActions && (
        <div className="fixed left-6 bottom-28 z-40 w-[360px] max-w-[92vw]">
          <div className="rounded-xl bg-white/95 backdrop-blur shadow-xl border border-gray-200">
            <div className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600">
              Conversation finished
            </div>

            <div className="px-4 py-3 text-[13px] text-gray-700">
              <div className="mb-2">
                Save or manage the transcript of your last conversation.
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
                <pre className="whitespace-pre-wrap text-[12px] leading-snug">
                  {joinedText || "(empty)"}
                </pre>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <button
                  onClick={handleSaveTxt}
                  className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Save .txt
                </button>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-800"
                >
                  Copy
                </button>
                <button
                  onClick={handleDeleteLocal}
                  className="px-3 py-1.5 text-sm rounded-md bg-rose-500 text-white hover:bg-rose-600"
                >
                  Delete
                </button>

                <button
                  onClick={handleSaveCloud}
                  disabled={saving}
                  className={`px-3 py-1.5 text-sm rounded-md ${
                    saving
                      ? "bg-emerald-300 text-white"
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  }`}
                >
                  {saving ? "Saving…" : "Save to cloud"}
                </button>

                {saveMsg && (
                  <span
                    className={`text-sm ${
                      saveMsg.startsWith("Saved")
                        ? "text-emerald-600"
                        : "text-gray-600"
                    }`}
                  >
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optional manual text -> voiced reply */}
      <div className="fixed left-6 bottom-48 z-30 w-[320px] max-w-[90vw]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const text = String(fd.get("t") || "").trim();
            if (text) sendMessage(text);
            e.currentTarget.reset();
          }}
          className="flex gap-2"
        >
          <input
            name="t"
            type="text"
            placeholder="Type to send text…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
}
