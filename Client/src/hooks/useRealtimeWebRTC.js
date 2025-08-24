// Client/src/hooks/useRealtimeWebRTC.js
// Low-level WebRTC helper for OpenAI Realtime.
// Creates an RTCPeerConnection, streams MIC -> model, receives remote TTS AUDIO,
// exposes small state + actions for the UI layer.

import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

export function useRealtimeWebRTC() {
  // --- refs / internals ---
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioElRef = useRef(null);
  const sendDCRef = useRef(null);
  const recvDCRef = useRef(null);
  const tokenRef = useRef(null);
  const modelRef = useRef(null);

  // voice activity detector (for a subtle "speaking" signal)
  const audioCtxRef = useRef(null);
  const vadRef = useRef({ alive: false, raf: 0 });

  // --- public state ---
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | disconnecting
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState([]);      // [{ id, text }]
  const [partialTranscript, setPartialTranscript] = useState("");

  const log = (...a) => { if (DEBUG) console.log("[RealtimeWebRTC]", ...a); };

  // --- audio element for remote playback ---
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

  // --- speaking detector on REMOTE stream (for UI pulse only) ---
  const startSpeakingDetector = (remoteStream) => {
    try {
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (!ACtx || !remoteStream) return;

      // ensure single context
      if (!audioCtxRef.current) audioCtxRef.current = new ACtx();

      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      vadRef.current.alive = true;

      const tick = () => {
        if (!vadRef.current.alive) return;
        try {
          analyser.getByteTimeDomainData(data);
          let maxDev = 0;
          for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i] - 128);
            if (v > maxDev) maxDev = v;
          }
          setIsSpeaking(maxDev > 10);
        } finally {
          // guard: raf may be cleared during teardown; only schedule if alive
          if (vadRef.current.alive) {
            vadRef.current.raf = requestAnimationFrame(tick);
          }
        }
      };
      // kick off
      vadRef.current.raf = requestAnimationFrame(tick);
    } catch (e) {
      // non-fatal: some browsers block AudioContext until user gesture
      if (DEBUG) console.warn("speaking detector unavailable:", e);
    }
  };

  const stopSpeakingDetector = () => {
    try {
      vadRef.current.alive = false;
      if (vadRef.current.raf) cancelAnimationFrame(vadRef.current.raf);
      vadRef.current.raf = 0;
      setIsSpeaking(false);
      if (audioCtxRef.current) {
        // don't close globally (Safari pop) — but free if suspended
        // try { audioCtxRef.current.close(); } catch {}
      }
    } catch {}
  };

  // --- incoming server events on data channel (transcripts) ---
  const handleServerEvent = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (DEBUG) log("recv:", msg);

      // Generic transcript support
      if (msg.type === "transcript.partial" && typeof msg.text === "string") {
        setPartialTranscript(msg.text);
      } else if (msg.type === "transcript.completed" && typeof msg.text === "string") {
        setPartialTranscript("");
        setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: msg.text }]);
      }

      // Response streaming (alternate schema)
      if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
        setPartialTranscript((p) => p + msg.delta);
      } else if (msg.type === "response.completed" && msg.response?.output_text) {
        const full = Array.isArray(msg.response.output_text)
          ? msg.response.output_text.join("")
          : String(msg.response.output_text || "");
        if (full.trim()) {
          setPartialTranscript("");
          setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: full }]);
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

      // 2) Remote audio
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        const el = ensureAudioElement();
        el.srcObject = stream;
        el.play().catch(() => {});
        startSpeakingDetector(stream);
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
      stopSpeakingDetector();
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
    } finally {
      stopSpeakingDetector();
      setIsListening(false);
      setIsConnected(false);
      setStatus("idle");
    }
  }, []);

  // --- send text (model replies via audio) ---
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
      stopSpeakingDetector();
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
