// Client/src/hooks/useRealtimeWebRTC.js
// WebRTC to OpenAI Realtime (mic + reasoning).
// TTS: ElevenLabs when VITE_TTS_PROVIDER=elevenlabs, otherwise OpenAI remote audio.

import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

const USE_ELEVEN = (import.meta.env.VITE_TTS_PROVIDER || "").toLowerCase() === "elevenlabs";
const TTS_ENDPOINT = "/.netlify/functions/tts-eleven";

export function useRealtimeWebRTC() {
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);

  const audioElRef = useRef(null);     // OpenAI remote audio (fallback)
  const localTTSRef = useRef(null);    // ElevenLabs local player

  const sendDCRef = useRef(null);
  const recvDCRef = useRef(null);
  const tokenRef = useRef(null);
  const modelRef = useRef(null);

  const audioCtxRef = useRef(null);
  const vadRemoteRef = useRef({ alive: false, raf: 0 });

  const [status, setStatus] = useState("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState([]);      // [{ id, text }]
  const [partialTranscript, setPartialTranscript] = useState("");

  const log = (...a) => { if (DEBUG) console.log("[RealtimeWebRTC]", ...a); };

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

  // ---- ElevenLabs playback (speak once per turn) ----
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

  // ---- Remote speaking pulse (OpenAI audio only) ----
  const startRemotePulse = (remoteStream) => {
    if (USE_ELEVEN) return;
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
    try {
      vadRemoteRef.current.alive = false;
      if (vadRemoteRef.current.raf) cancelAnimationFrame(vadRemoteRef.current.raf);
      vadRemoteRef.current.raf = 0;
      setIsSpeaking(false);
    } catch {}
  };

  // ---- Make sure we request a reply on each user turn ----
  const requestResponse = () => {
    if (!sendDCRef.current || sendDCRef.current.readyState !== "open") return;
    try {
      sendDCRef.current.send(JSON.stringify({ type: "response.create" }));
      DEBUG && log("sent: response.create");
    } catch {}
  };

  // ---- Handle server events (ASR + response text) ----
  const handleServerEvent = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (DEBUG) log("recv:", msg);

      // ASR partial/completed
      if (msg.type === "transcript.partial" && typeof msg.text === "string") {
        setPartialTranscript(msg.text);
      } else if (msg.type === "transcript.completed" && typeof msg.text === "string") {
        setPartialTranscript("");
        setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: msg.text }]);
        // <- Ensure the assistant actually replies after your utterance
        requestResponse();
      }

      // Some runtimes send explicit turn markers; reply when user finishes
      if (msg.type === "input_audio_buffer.speech_stopped") {
        requestResponse();
      }

      // New text output schema
      if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
        setPartialTranscript((p) => p + msg.delta);
      } else if (msg.type === "response.completed" && msg.response?.output_text) {
        const full = Array.isArray(msg.response.output_text)
          ? msg.response.output_text.join("")
          : String(msg.response.output_text || "");
        if (full.trim()) {
          setPartialTranscript("");
          setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: full }]);
          if (USE_ELEVEN) playEleven(full);
        }
      }
    } catch {
      // ignore
    }
  };

  // ---- Connect ----
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
      };

      pc.ontrack = (e) => {
        if (USE_ELEVEN) return; // ignore; ElevenLabs will handle TTS
        const [stream] = e.streams;
        const el = ensureAudioElement();
        el.srcObject = stream;
        el.play().catch(() => {});
        startRemotePulse(stream);
      };

      pc.ondatachannel = (e) => {
        recvDCRef.current = e.channel;
        recvDCRef.current.onmessage = handleServerEvent;
        DEBUG && log("recv channel open");
      };

      // Create the send data channel BEFORE the offer so it’s negotiated
      sendDCRef.current = pc.createDataChannel("oai-events");
      sendDCRef.current.onopen = () => DEBUG && log("send channel open");

      // Enable send/recv audio
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

      // Local VAD for barge-in: cancel current TTS if you start speaking
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
            if (!speaking && nowSpeaking && sendDCRef.current && sendDCRef.current.readyState === "open") {
              try { sendDCRef.current.send(JSON.stringify({ type: "response.cancel" })); } catch {}
              if (localTTSRef.current) { try { localTTSRef.current.pause(); } catch {}; localTTSRef.current = null; setIsSpeaking(false); }
            }
            speaking = nowSpeaking;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      } catch {}

      // SDP offer/answer
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
      try { if (pcRef.current) pcRef.current.close(); } catch {}
      pcRef.current = null;
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setStatus("idle");
    }
  }, [isConnected, status]);

  // ---- Disconnect ----
  const disconnect = useCallback(() => {
    setStatus("disconnecting");
    try {
      if (sendDCRef.current) { try { sendDCRef.current.close(); } catch {} sendDCRef.current = null; }
      if (recvDCRef.current) { try { recvDCRef.current.close(); } catch {} recvDCRef.current = null; }
      if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
      if (localTTSRef.current) { try { localTTSRef.current.pause(); } catch {} localTTSRef.current = null; }
    } finally {
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setIsSpeaking(false);
      setStatus("idle");
    }
  }, []);

  // ---- Manual text (optional) ----
  const sendText = useCallback((text) => {
    if (!sendDCRef.current || sendDCRef.current.readyState !== "open") return;
    try {
      sendDCRef.current.send(JSON.stringify({ type: "input_text.append", text }));
      sendDCRef.current.send(JSON.stringify({ type: "response.create" }));
      DEBUG && log("sent text + response.create");
    } catch (e) {
      setLastError(String(e?.message || e));
    }
  }, []);

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
