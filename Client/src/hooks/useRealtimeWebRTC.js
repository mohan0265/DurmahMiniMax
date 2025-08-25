// Client/src/hooks/useRealtimeWebRTC.js
// WebRTC to OpenAI Realtime (mic + reasoning).
// Voice turns are driven by server VAD (configured in the Netlify session function).
// We DO NOT send response.create for voice turns; only for manual text.
// Remote TTS is played from the Realtime server; we also capture its transcript
// via response.audio_transcript.delta/done so your UI can display assistant text.

import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

export function useRealtimeWebRTC() {
  // ---- internals / refs ----
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);

  const audioElRef = useRef(null);      // remote audio element
  const dcRef = useRef(null);           // single data channel
  const tokenRef = useRef(null);
  const modelRef = useRef(null);

  // remote speaking pulse (visual only)
  const audioCtxRef = useRef(null);
  const vadRemoteRef = useRef({ alive: false, raf: 0 });

  // track if assistant is currently replying (to gate barge-in cancel)
  const activeReplyRef = useRef(false);

  // ---- public state ----
  const [status, setStatus] = useState("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState([]);        // [{ id, text }]
  const [partialTranscript, setPartialTranscript] = useState("");

  const log = (...a) => { if (DEBUG) console.log("[RealtimeWebRTC]", ...a); };

  // ---------- helpers ----------
  const ensureAudioElement = () => {
    if (!audioElRef.current) {
      const el = new Audio();
      el.autoplay = true;
      el.playsInline = true;
      el.muted = false;
      el.volume = 1.0;
      audioElRef.current = el;
      // Do NOT append to the DOM visually; autoplay works without it
    }
    return audioElRef.current;
  };

  // speaking pulse on remote stream (UI only)
  const startRemotePulse = (remoteStream) => {
    try {
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (!ACtx || !remoteStream) return;
      if (!audioCtxRef.current) audioCtxRef.current = new ACtx();
      const ctx = audioCtxRef.current;
      const src = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const data = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);

      vadRemoteRef.current.alive = true;
      const tick = () => {
        if (!vadRemoteRef.current.alive) return;
        analyser.getByteTimeDomainData(data);
        let md = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128);
          if (v > md) md = v;
        }
        setIsSpeaking(md > 10);
        if (vadRemoteRef.current.alive) vadRemoteRef.current.raf = requestAnimationFrame(tick);
      };
      vadRemoteRef.current.raf = requestAnimationFrame(tick);
    } catch {}
  };

  const stopRemotePulse = () => {
    vadRemoteRef.current.alive = false;
    if (vadRemoteRef.current.raf) cancelAnimationFrame(vadRemoteRef.current.raf);
    vadRemoteRef.current.raf = 0;
    setIsSpeaking(false);
  };

  // ---------- server messages ----------
  const handleServerEvent = (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    DEBUG && log("recv:", msg.type, msg);

    // Track reply activity for barge-in
    if (msg.type === "output_audio_buffer.started") {
      activeReplyRef.current = true;
    }
    if (msg.type === "output_audio_buffer.stopped" || msg.type === "response.done" || msg.type === "response.completed") {
      activeReplyRef.current = false;
    }

    // Errors
    if (msg.type === "error") {
      setLastError(msg.error?.message || "Server error");
      return;
    }

    // USER ASR (when present)
    if (msg.type === "transcript.partial" && typeof msg.text === "string") {
      // some backends send user partials like this
      setPartialTranscript(msg.text);
      return;
    }
    if (msg.type === "transcript.completed" && typeof msg.text === "string") {
      setPartialTranscript("");
      setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: msg.text }]);
      return;
    }

    // ASSISTANT TEXT (when the model streams output text)
    if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
      setPartialTranscript((p) => p + msg.delta);
      return;
    }
    if (msg.type === "response.completed") {
      const out = msg.response?.output_text;
      const full = Array.isArray(out) ? out.join("") : (typeof out === "string" ? out : "");
      if (full && full.trim()) {
        setPartialTranscript("");
        setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: full }]);
      }
      return;
    }

    // ASSISTANT SPEECH TRANSCRIPT (this is what your console shows)
    if (msg.type === "response.audio_transcript.delta" && typeof msg.delta === "string") {
      setPartialTranscript((p) => p + msg.delta);
      return;
    }
    if (msg.type === "response.audio_transcript.done") {
      const full = typeof msg.transcript === "string" ? msg.transcript
                 : (typeof msg.text === "string" ? msg.text : "");
      const finalText = full || partialTranscript;
      if (finalText && finalText.trim()) {
        setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: finalText }]);
      }
      setPartialTranscript("");
      return;
    }
  };

  // ---------- connect ----------
  const connect = useCallback(async ({ token, model }) => {
    if (isConnected || status === "connecting") return;
    setStatus("connecting");
    setLastError(null);
    tokenRef.current = token;
    modelRef.current = model;

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        DEBUG && log("pc state:", pc.connectionState);
        if (pc.connectionState === "connected") setIsConnected(true);
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
          setIsConnected(false);
          setStatus("idle");
        }
      };

      // Remote audio
      pc.ontrack = (e) => {
        const stream = e?.streams?.[0] || new MediaStream([e.track]);
        const el = ensureAudioElement();
        try { el.srcObject = stream; } catch {}
        el.play().catch(() => {});
        startRemotePulse(stream);
      };

      // Data channel
      dcRef.current = pc.createDataChannel("oai-events");
      dcRef.current.onopen = () => DEBUG && log("data channel open");
      dcRef.current.onmessage = handleServerEvent;

      // Audio send/recv
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // Mic
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        setLastError("Microphone permission denied");
        throw err;
      }
      micStreamRef.current = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setIsListening(true);

      // Local barge-in: cancel only when a reply is active
      try {
        const ACtx = window.AudioContext || window.webkitAudioContext;
        if (ACtx) {
          const ctx = new ACtx();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          const data = new Uint8Array(analyser.frequencyBinCount);
          src.connect(analyser);
          let speaking = false;
          const tick = () => {
            analyser.getByteTimeDomainData(data);
            let maxDev = 0;
            for (let i = 0; i < data.length; i++) {
              const v = Math.abs(data[i] - 128);
              if (v > maxDev) maxDev = v;
            }
            const nowSpeaking = maxDev > 10;
            if (!speaking && nowSpeaking && activeReplyRef.current && dcRef.current && dcRef.current.readyState === "open") {
              try { dcRef.current.send(JSON.stringify({ type: "response.cancel" })); } catch {}
            }
            speaking = nowSpeaking;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      } catch {}

      // Offer/Answer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(modelRef.current)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
        body: offer.sdp,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const answer = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      setStatus("connected");
      setIsConnected(true);
      DEBUG && log("connected");
    } catch (e) {
      console.error(e);
      setLastError(String(e?.message || e));
      try { if (pcRef.current) pcRef.current.close(); } catch {}
      pcRef.current = null;
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setStatus("idle");
    }
  }, [isConnected, status, partialTranscript]);

  // ---------- disconnect ----------
  const disconnect = useCallback(() => {
    setStatus("disconnecting");
    try {
      if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
      if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
    } finally {
      activeReplyRef.current = false;
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setIsSpeaking(false);
      setStatus("idle");
    }
  }, []);

  // ---------- manual text ----------
  const sendText = useCallback((text) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    const t = String(text || "").trim();
    if (!t) return;
    try {
      dcRef.current.send(JSON.stringify({ type: "input_text.append", text: t }));
      dcRef.current.send(JSON.stringify({ type: "response.create" }));
      DEBUG && log("sent text + response.create");
    } catch (e) {
      setLastError(String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    return () => {
      try { disconnect(); } catch {}
      if (audioElRef.current) { try { audioElRef.current.srcObject = null; } catch {} }
      stopRemotePulse();
      if (audioCtxRef.current) { try { audioCtxRef.current.suspend(); } catch {} }
    };
  }, [disconnect]);

  return {
    status,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    partialTranscript,
    lastError,
    connect,
    disconnect,
    sendText,
  };
}
