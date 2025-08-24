// Client/src/hooks/useRealtimeWebRTC.js
// WebRTC to OpenAI Realtime (mic + reasoning).
// TTS playback: ElevenLabs (turn-based) when VITE_TTS_PROVIDER=elevenlabs,
// otherwise fall back to OpenAI remote audio track.

import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

// ---- Switch between ElevenLabs vs OpenAI remote audio ----
const USE_ELEVEN = (import.meta.env.VITE_TTS_PROVIDER || "").toLowerCase() === "elevenlabs";
const TTS_ENDPOINT = "/.netlify/functions/tts-eleven"; // Netlify proxy you added

export function useRealtimeWebRTC() {
  // --- refs / internals ---
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);

  // OpenAI remote audio (only used when not using ElevenLabs)
  const audioElRef = useRef(null);

  // ElevenLabs local player element (we synth + play once per turn)
  const localTTSRef = useRef(null);

  const sendDCRef = useRef(null);
  const recvDCRef = useRef(null);
  const tokenRef = useRef(null);
  const modelRef = useRef(null);

  // voice activity detector (for a subtle "speaking" signal)
  const audioCtxRef = useRef(null);
  const vadRemoteRef = useRef({ alive: false, raf: 0 });

  // --- public state ---
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | disconnecting
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState([]);      // [{ id, text }]
  const [partialTranscript, setPartialTranscript] = useState("");

  const log = (...a) => { if (DEBUG) console.log("[RealtimeWebRTC]", ...a); };

  // --- audio element for remote playback (OpenAI fallback) ---
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

  // --- speaking detector on REMOTE stream (for UI pulse only, OpenAI audio path) ---
  const startRemotePulse = (remoteStream) => {
    if (USE_ELEVEN) return; // not used when ElevenLabs handles TTS
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
        try {
          analyser.getByteTimeDomainData(data);
          let maxDev = 0;
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i] - 128);
            if (v > maxDev) maxDev = v;
          }
          setIsSpeaking(maxDev > 10);
        } finally {
          if (vadRemoteRef.current.alive) {
            vadRemoteRef.current.raf = requestAnimationFrame(tick);
          }
        }
      };
      vadRemoteRef.current.raf = requestAnimationFrame(tick);
    } catch (e) {
      if (DEBUG) console.warn("speaking detector unavailable:", e);
    }
  };

  const stopRemotePulse = () => {
    try {
      vadRemoteRef.current.alive = false;
      if (vadRemoteRef.current.raf) cancelAnimationFrame(vadRemoteRef.current.raf);
      vadRemoteRef.current.raf = 0;
      setIsSpeaking(false);
    } catch {}
  };

  // --- ElevenLabs playback (turn-based; speak once per completed response) ---
  const playEleven = async (text) => {
    try {
      if (!text || !text.trim()) return;

      // stop previous playback if any
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
      const el = new Audio();
      el.src = url;
      el.onended = () => {
        try { URL.revokeObjectURL(url); } catch {}
        if (localTTSRef.current === el) localTTSRef.current = null;
        setIsSpeaking(false);
      };
      localTTSRef.current = el;
      setIsSpeaking(true);
      await el.play();
    } catch (e) {
      console.error(e);
      setLastError(String(e?.message || e));
      setIsSpeaking(false);
    }
  };

  // --- incoming server events on data channel (transcripts + output text) ---
  const handleServerEvent = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (DEBUG) log("recv:", msg);

      // Generic transcript from ASR
      if (msg.type === "transcript.partial" && typeof msg.text === "string") {
        setPartialTranscript(msg.text);
      } else if (msg.type === "transcript.completed" && typeof msg.text === "string") {
        setPartialTranscript("");
        setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: msg.text }]);
      }

      // OpenAI "new" output schema (we use completed text for ElevenLabs)
      if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
        // accumulate partial for on-screen hints; do NOT speak deltas with ElevenLabs
        setPartialTranscript((p) => p + msg.delta);
      } else if (msg.type === "response.completed" && msg.response?.output_text) {
        const full = Array.isArray(msg.response.output_text)
          ? msg.response.output_text.join("")
          : String(msg.response.output_text || "");
        if (full.trim()) {
          setPartialTranscript("");
          setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: full }]);
          if (USE_ELEVEN) {
            // speak once per turn (smooth, non-interruptive)
            playEleven(full);
          }
        }
      }
    } catch {
      // ignore non-JSON
    }
  };

  // --- connect ---
  const connect = useCallback(async ({ token, model }) => {
    if (isConnected || status === "connecting") return;
    setStatus("connecting");
    setLastError(null);
    tokenRef.current = token;
    modelRef.current = model;

    try {
      // 1) Peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 2) Remote audio (used only when not using ElevenLabs)
      pc.ontrack = (e) => {
        if (USE_ELEVEN) return; // ignore remote audio; ElevenLabs will handle TTS
        const [stream] = e.streams;
        const el = ensureAudioElement();
        el.srcObject = stream;
        el.play().catch(() => {});
        startRemotePulse(stream);
      };

      // 3) Data channels
      pc.ondatachannel = (e) => {
        recvDCRef.current = e.channel;
        recvDCRef.current.onmessage = handleServerEvent;
      };
      sendDCRef.current = pc.createDataChannel("oai-events");
      sendDCRef.current.onopen = () => DEBUG && log("send channel open");

      // 4) Send mic, receive audio
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // 5) Ask for mic *after* user tap, pipe to pc
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

      // ---- BARGe-IN local VAD: cancel any current TTS when user starts speaking ----
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

            // rising edge = you started talking -> cancel current TTS immediately
            if (!speaking && nowSpeaking && sendDCRef.current && sendDCRef.current.readyState === "open") {
              try {
                sendDCRef.current.send(JSON.stringify({ type: "response.cancel" }));
              } catch {}
              // also stop ElevenLabs playback if active
              if (localTTSRef.current) {
                try { localTTSRef.current.pause(); } catch {}
                localTTSRef.current = null;
                setIsSpeaking(false);
              }
            }
            speaking = nowSpeaking;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      } catch {}

      // 6) Offer/Answer via OpenAI Realtime
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
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Realtime SDP exchange failed: ${txt}`);
      }
      const answer = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      setStatus("connected");
      setIsConnected(true);
      DEBUG && log("connected");
    } catch (e) {
      console.error(e);
      setLastError(String(e?.message || e));
      // clean up on failure
      try { if (pcRef.current) pcRef.current.close(); } catch {}
      pcRef.current = null;
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setStatus("idle");
    }
  }, [isConnected, status]);

  // --- disconnect ---
  const disconnect = useCallback(() => {
    setStatus("disconnecting");
    try {
      if (sendDCRef.current) { try { sendDCRef.current.close(); } catch {} sendDCRef.current = null; }
      if (recvDCRef.current) { try { recvDCRef.current.close(); } catch {} recvDCRef.current = null; }
      if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (localTTSRef.current) {
        try { localTTSRef.current.pause(); } catch {}
        localTTSRef.current = null;
      }
    } finally {
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setIsSpeaking(false);
      setStatus("idle");
    }
  }, []);

  // --- send text (model replies via ElevenLabs/OpenAI audio) ---
  const sendText = useCallback((text) => {
    if (!sendDCRef.current || sendDCRef.current.readyState !== "open") return;
    const a = { type: "input_text.append", text };
    const b = { type: "response.create" };
    try {
      sendDCRef.current.send(JSON.stringify(a));
      sendDCRef.current.send(JSON.stringify(b));
      DEBUG && log("sent:", a, b);
    } catch (e) {
      setLastError(String(e?.message || e));
    }
  }, []);

  // --- cleanup on unmount ---
  useEffect(() => {
    return () => {
      try { disconnect(); } catch {}
      if (audioElRef.current) {
        try { audioElRef.current.srcObject = null; } catch {}
        try { audioElRef.current.remove(); } catch {}
      }
      if (localTTSRef.current) {
        try { localTTSRef.current.pause(); } catch {}
        localTTSRef.current = null;
      }
      stopRemotePulse();
      if (audioCtxRef.current) {
        try { audioCtxRef.current.suspend(); } catch {}
      }
    };
  }, [disconnect]);

  return {
    // state
    status,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    partialTranscript,
    lastError,

    // api
    connect,
    disconnect,
    sendText,
  };
}
