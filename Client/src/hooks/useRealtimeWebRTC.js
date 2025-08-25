// Client/src/hooks/useRealtimeWebRTC.js
// WebRTC to OpenAI Realtime (mic + reasoning).
// Voice turns are driven by server VAD (we do NOT send response.create for voice).
// TTS: ElevenLabs when VITE_TTS_PROVIDER=elevenlabs, else OpenAI remote audio.

import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

const USE_ELEVEN = (import.meta.env.VITE_TTS_PROVIDER || "").toLowerCase() === "elevenlabs";
const TTS_ENDPOINT = "/.netlify/functions/tts-eleven";

export function useRealtimeWebRTC() {
  // internals
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);

  const audioElRef = useRef(null);      // OpenAI remote audio (fallback)
  const localTTSRef = useRef(null);     // ElevenLabs audio element
  const dcRef = useRef(null);

  const audioCtxRef = useRef(null);
  const vadRemoteRef = useRef({ alive: false, raf: 0 });

  const activeResponseRef = useRef(false); // assistant is mid-reply
  const replyBufferRef = useRef("");       // accumulates output_text delta

  // public state
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | disconnecting
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState([]);      // [{ id, text }]
  const [partialTranscript, setPartialTranscript] = useState("");

  const log = (...a) => { if (DEBUG) console.log("[RealtimeWebRTC]", ...a); };

  // ---------- helpers ----------
  const ensureAudioElement = () => {
    if (!audioElRef.current) {
      const el = new Audio();
      el.autoplay = true;
      el.playsInline = true;
      el.muted = false;
      audioElRef.current = el;
      document.body.appendChild(el);
    }
    return audioElRef.current;
  };

  const startRemotePulse = (remoteStream) => {
    if (USE_ELEVEN) return; // we won't play remote audio in ElevenLabs mode
    try {
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (!ACtx || !remoteStream) return;
      if (!audioCtxRef.current) audioCtxRef.current = new ACtx();
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      vadRemoteRef.current.alive = true;
      const tick = () => {
        if (!vadRemoteRef.current.alive) return;
        analyser.getByteTimeDomainData(data);
        let maxDev = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128);
          if (v > maxDev) maxDev = v;
        }
        setIsSpeaking(maxDev > 10);
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

  const playEleven = async (text) => {
    try {
      if (!text || !text.trim()) return;
      if (localTTSRef.current) {
        try { localTTSRef.current.pause(); } catch {}
        try { URL.revokeObjectURL(localTTSRef.current.src); } catch {}
        localTTSRef.current = null;
      }
      const resp = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`TTS failed: ${t}`);
      }
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const el = new Audio(url);
      el.onended = () => {
        try { URL.revokeObjectURL(url); } catch {}
        if (localTTSRef.current === el) localTTSRef.current = null;
        setIsSpeaking(false);
        activeResponseRef.current = false;
      };
      localTTSRef.current = el;
      setIsSpeaking(true);
      activeResponseRef.current = true;
      await el.play();
    } catch (e) {
      console.error(e);
      setLastError(String(e?.message || e));
      setIsSpeaking(false);
      activeResponseRef.current = false;
    }
  };

  // ---------- finalize one assistant turn ----------
  const flushReply = (idHint) => {
    const full = replyBufferRef.current.trim();
    replyBufferRef.current = "";
    if (full) {
      setPartialTranscript("");
      setTranscript((old) => [...old, { id: idHint || crypto.randomUUID(), text: full }]);
      if (USE_ELEVEN) {
        // Speak once via ElevenLabs
        void playEleven(full);
      } else {
        // Remote audio path shows pulse; ensure state
        setIsSpeaking(true);
      }
    }
    activeResponseRef.current = false;
  };

  // ---------- server messages ----------
  const handleServerEvent = (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    if (DEBUG) log("recv:", msg);

    // errors / rate limit
    if (msg.type === "error") {
      setLastError(msg.error?.message || "Server error");
      activeResponseRef.current = false;
      return;
    }
    if (msg.type === "rate_limits.updated") return;

    // user ASR live text (if server sends it)
    if (msg.type === "transcript.partial" && typeof msg.text === "string") {
      setPartialTranscript(msg.text);
      return;
    }
    if (msg.type === "transcript.completed" && typeof msg.text === "string") {
      setPartialTranscript("");
      setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: msg.text }]);
      return;
    }

    // assistant lifecycle (newer schema)
    if (msg.type === "response.created" || msg.type === "conversation.item.created") {
      activeResponseRef.current = true;
      // start a new buffer for any deltas that follow
      replyBufferRef.current = "";
      return;
    }

    // assistant text streaming (newer schema)
    if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
      replyBufferRef.current += msg.delta;
      setPartialTranscript((p) => (p + msg.delta));
      activeResponseRef.current = true;
      return;
    }
    if (msg.type === "response.output_text.done") {
      // part finished; keep waiting for response.done to flush
      return;
    }

    // assistant done (OpenAI sends either response.completed OR response.done)
    if (msg.type === "response.completed" || msg.type === "response.done") {
      flushReply(msg.response?.id || msg.id);
      return;
    }

    // older schema fallback (just in case)
    if (msg.type === "response.completed" && msg.response?.output_text) {
      const out = msg.response.output_text;
      const full = Array.isArray(out) ? out.join("") : String(out || "");
      replyBufferRef.current = full;
      flushReply(msg.id);
      return;
    }
  };

  // ---------- connect ----------
  const connect = useCallback(async ({ token, model }) => {
    if (isConnected || status === "connecting") return;
    setStatus("connecting");
    setLastError(null);

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (DEBUG) log("pc state:", pc.connectionState);
        if (pc.connectionState === "connected") setIsConnected(true);
      };

      // remote audio only when not using ElevenLabs
      pc.ontrack = (e) => {
        if (USE_ELEVEN) return;
        const [stream] = e.streams;
        const el = ensureAudioElement();
        el.srcObject = stream;
        el.play().catch(() => {});
        startRemotePulse(stream);
      };

      // data channel
      dcRef.current = pc.createDataChannel("oai-events");
      dcRef.current.onopen = () => { if (DEBUG) log("data channel open"); };
      dcRef.current.onmessage = handleServerEvent;

      // audio transceiver: sendonly when ElevenLabs
      pc.addTransceiver("audio", { direction: USE_ELEVEN ? "sendonly" : "sendrecv" });

      // mic
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setLastError("Microphone permission denied");
        throw new Error("MIC_DENIED");
      }
      micStreamRef.current = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setIsListening(true);

      // local barge-in: only cancel if a reply is active
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

            if (!speaking && nowSpeaking && activeResponseRef.current && dcRef.current && dcRef.current.readyState === "open") {
              try { dcRef.current.send(JSON.stringify({ type: "response.cancel" })); } catch {}
              if (localTTSRef.current) { try { localTTSRef.current.pause(); } catch {} localTTSRef.current = null; }
              setIsSpeaking(false);
              activeResponseRef.current = false;
              replyBufferRef.current = "";
              setPartialTranscript("");
            }
            speaking = nowSpeaking;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      } catch {}

      // SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
      if (DEBUG) log("connected");
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
  }, [isConnected, status]);

  // ---------- disconnect ----------
  const disconnect = useCallback(() => {
    setStatus("disconnecting");
    try {
      if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
      if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
      if (localTTSRef.current) { try { localTTSRef.current.pause(); } catch {} localTTSRef.current = null; }
    } finally {
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setIsSpeaking(false);
      activeResponseRef.current = false;
      replyBufferRef.current = "";
      setPartialTranscript("");
      setStatus("idle");
    }
  }, []);

  // ---------- manual text ----------
  const sendText = useCallback((text) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    try {
      dcRef.current.send(JSON.stringify({ type: "input_text.append", text }));
      dcRef.current.send(JSON.stringify({ type: "response.create" }));
      if (DEBUG) log("sent text + response.create");
    } catch (e) {
      setLastError(String(e?.message || e));
    }
  }, []);

  // cleanup
  useEffect(() => {
    return () => {
      try { disconnect(); } catch {}
      if (audioElRef.current) { try { audioElRef.current.srcObject = null; } catch {}; try { audioElRef.current.remove(); } catch {} }
      if (localTTSRef.current) { try { localTTSRef.current.pause(); } catch {}; localTTSRef.current = null; }
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
