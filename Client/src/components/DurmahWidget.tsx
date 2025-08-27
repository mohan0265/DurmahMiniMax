// src/components/DurmahWidget.tsx
// Final host-aware widget:
// - Uses Supabase + user from the host app via supabaseBridge
// - Saves transcripts to public.voice_conversations with optional academic context
// - One client, one session (RLS-safe). No duplicate Supabase instances.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Save, Trash2, FileText } from "lucide-react";
import { supabase, useAuth } from "../lib/supabaseBridge";
import { useRealtimeVoice } from "../hooks/useRealtimeVoice";

type WidgetProps = {
  /** Optional academic context: pass from YAAG, module pages, etc. */
  context?: {
    route?: string;
    term?: "Michaelmas" | "Epiphany" | "Easter" | string;
    year_label?: string;      // e.g. "Year 1 (LLB)"
    module_id?: string;       // your modules table id (uuid or text)
    module_code?: string;     // e.g. "LAW1234"
    week?: string;            // e.g. "Week 5"
    tags?: string[];          // free-form labels
    extra?: Record<string, any>;
  };
};

type Line = { id: string; text: string };

type AnyLine = { id?: string | number; text?: string } | string;

/** Make sure transcript is always [{id, text}] for our widget */
function normalizeTranscript(arr: AnyLine[] | undefined | null): Line[] {
  if (!arr) return [];
  return arr.map((t, idx) => {
    if (typeof t === "string") {
      return { id: String(idx), text: t };
    }
    return {
      id: String(t.id ?? idx),
      text: String(t.text ?? ""),
    };
  });
}


const fmtTime = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export default function DurmahWidget({ context }: WidgetProps) {
  // Use *host* app auth so RLS == student’s session
  const { user } = useAuth() || { user: null };

  // Your voice hook (works as-is)
  const {
    status,              // "idle" | "connecting" | "connected"
    isConnected,
    isListening,
    isSpeaking,
    transcript,          // [{id,text}, ...]
    partialTranscript,   // live partial line
    connect,
    startVoiceMode,
    stopVoiceMode,
    lastError,
  } = useRealtimeVoice();

  // Track session start for metadata
  const sessionStartRef = useRef<string | null>(null);

  // Local buffer we can save/delete without mutating the hook
  const [localTranscript, setLocalTranscript] = useState<Line[]>([]);
  useEffect(() => {
  setLocalTranscript(normalizeTranscript(transcript as unknown as AnyLine[]));
}, [transcript]);


  const [showActions, setShowActions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [cloudId, setCloudId] = useState<string | null>(null);

  const joinedText = useMemo(
    () => localTranscript.map(l => l.text).join("\n"),
    [localTranscript]
  );

  const copyToClipboard = async () => {
    setSaveMsg(null);
    try {
      await navigator.clipboard.writeText(joinedText || "");
      setSaveMsg("Copied to clipboard ✅");
    } catch (e: any) {
      setSaveMsg(`Copy failed: ${e?.message || e}`);
    }
  };

  const saveTxtFile = () => {
    setSaveMsg(null);
    const blob = new Blob([joinedText || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `durmah-${fmtTime()}.txt`,
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const deleteLocal = () => {
    setSaveMsg(null);
    setLocalTranscript([]);
    setShowActions(false);
  };

  // --- Save to Supabase with RLS ---
  const saveToCloud = async () => {
    setSaveMsg(null);
    if (!joinedText.trim()) {
      setSaveMsg("Nothing to save.");
      return;
    }
    setSaving(true);
    try {
      // IMPORTANT: use same client/session as host app
      const { data: auth } = await supabase.auth.getUser();
      const authedUser = auth?.user ?? user;
      if (!authedUser) {
        setSaveMsg("Please sign in to save notes.");
        setSaving(false);
        return;
      }

      const started_at = sessionStartRef.current ?? new Date().toISOString();
      const ended_at = new Date().toISOString();

      const payload = {
        user_id: authedUser.id,
        title: `Durmah conversation ${fmtTime()}`,
        content: joinedText,
        started_at,
        ended_at,
        metadata: {
          status,
          partial_last: partialTranscript || null,
          context: context || null,      // <- academic context travels with the note
        },
        // Optional denormalized columns for easy filtering (also inside metadata)
        context_route: context?.route ?? null,
        context_term: context?.term ?? null,
        context_module_id: context?.module_id ?? null,
        context_module_code: context?.module_code ?? null,
        context_year_label: context?.year_label ?? null,
        context_week: context?.week ?? null,
        context_tags: context?.tags ?? null,
      };

      const { data, error } = await supabase
        .from("voice_conversations")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;
      setCloudId(data.id);
      setSaveMsg("Saved to cloud ✅");
    } catch (e: any) {
      setSaveMsg(`Save failed: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  // --- Delete from Supabase if saved ---
  const deleteFromCloud = async () => {
    setSaveMsg(null);
    if (!cloudId) {
      deleteLocal();
      return;
    }
    try {
      const { error } = await supabase.from("voice_conversations").delete().eq("id", cloudId);
      if (error) throw error;
      setCloudId(null);
      setSaveMsg("Deleted from cloud ✅");
      deleteLocal();
    } catch (e: any) {
      setSaveMsg(`Delete failed: ${e?.message || e}`);
    }
  };

  // --- Toggle Voice Session ---
  const toggleVoice = async () => {
    setSaveMsg(null);
    if (!isConnected) {
      await connect().catch(() => {});
    }
    if (status === "connecting") return;

    if (isSpeaking || isListening) {
      stopVoiceMode();
      // Keep transcript visible for actions
    } else {
      setShowActions(false);
      sessionStartRef.current = new Date().toISOString();
      await startVoiceMode().catch(() => {});
    }
  };

  const bubbleStatus = !isConnected
    ? "Offline"
    : isSpeaking
    ? "Speaking"
    : isListening
    ? "Listening"
    : "Connected";

  return (
    <>
      {/* Floating Mic Button */}
      <button
        onClick={toggleVoice}
        title={isListening || isSpeaking ? "End voice chat" : "Start voice chat"}
        className={`fixed right-6 bottom-6 z-50 rounded-full w-14 h-14 shadow-xl transition
          ${isListening || isSpeaking ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
      >
        <span className="sr-only">Toggle voice</span>
        <svg viewBox="0 0 24 24" className="w-8 h-8 m-auto fill-white">
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"></path>
          <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.08A7 7 0 0 0 19 11z"></path>
        </svg>
      </button>

      {/* Bottom Sheet with Transcript + Actions */}
      {(isListening || isSpeaking || localTranscript.length > 0) && (
        <div className="fixed left-4 right-4 bottom-24 md:left-8 md:right-8 md:bottom-8 z-40">
          <div className="max-h-[60vh] overflow-hidden rounded-2xl bg-white/90 backdrop-blur shadow-2xl border">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm text-gray-600">
                {bubbleStatus} {lastError ? `• ${String(lastError)}` : ""}
              </div>
              <button
                onClick={() => setShowActions((v) => !v)}
                className="text-indigo-600 text-sm font-medium hover:underline"
              >
                {showActions ? "Hide actions" : "Actions"}
              </button>
            </div>

            {/* Transcript */}
            <div className="p-4 h-[36vh] overflow-y-auto text-sm leading-6 text-gray-800">
              {localTranscript.length === 0 ? (
                <div className="text-gray-500">No transcript yet.</div>
              ) : (
                localTranscript.map((l) => (
                  <div key={l.id} className="mb-2">
                    {l.text}
                  </div>
                ))
              )}
              {partialTranscript && (
                <div className="italic text-gray-500">{partialTranscript}</div>
              )}
            </div>

            {/* Actions */}
            {showActions && (
              <div className="px-4 py-3 border-t flex flex-wrap gap-2 items-center">
                <button
                  onClick={saveTxtFile}
                  className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Save .txt
                </button>

                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>

                <button
                  onClick={deleteFromCloud}
                  className="px-3 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete{cloudId ? " (cloud)" : ""}
                </button>

                <button
                  disabled={saving}
                  onClick={saveToCloud}
                  className={`px-3 py-2 rounded-lg text-white flex items-center gap-2 ${
                    saving ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save to cloud"}
                </button>

                {saveMsg && <div className="ml-2 text-sm text-gray-600">{saveMsg}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
