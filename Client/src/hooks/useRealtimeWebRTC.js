// Client/src/hooks/useRealtimeWebRTC.js
// Low-level WebRTC helper for OpenAI Realtime.
// Exposes: connect({ token, model }), disconnect(), sendText(text)
// States: isConnected, isListening, isSpeaking, transcript, partialTranscript, status, lastError

import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

export function useRealtimeWebRTC() {
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioElRef = useRef(null);
  const sendDCRef = useRef(null);   // data channel to send events
  const recvDCRef = useRef(null);   // data channel from server
  const tokenRef = useRef(null);
  const modelRef = useRef(null);
  const speakingNodeRef = useRef(null); // analyser node
  const audioCtxRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle | connecting | connected | disconnecting
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState([]); // array of { id, text }
  const [partialTranscript, setPartialTranscript] = useState("");

  const log = (...args) => { if (DEBUG) console.log("[RealtimeWebRTC]", ...args); };

  // ---- helpers ----
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

  const setupSpeakingDetector = (stream) => {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      speakingNodeRef.current = { analyser, data, raf: null };
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        // Rough voice activity detect
        let maxDev = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128);
          if (v > maxDev) maxDev = v;
        }
        const speaking = maxDev > 10; // threshold
        setIsSpeaking(speaking);
        speakingNodeRef.current.raf = requestAnimationFrame(loop);
      };
      speakingNodeRef.current.raf = requestAnimationFrame(loop);
    } catch (_e) {
      // ignore analyser errors (Safari,etc.)
    }
  };

  const teardownSpeakingDetector = () => {
    if (speakingNodeRef.current?.raf) cancelAnimationFrame(speakingNodeRef.current.raf);
    speakingNodeRef.current = null;
    setIsSpeaking(false);
  };

  // ---- message handling (from OpenAI data channel) ----
  const handleServerEvent = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (DEBUG) log("recv:", msg);

      // Transcripts may arrive as "transcript.partial" / "transcript.completed"
      if (msg.type === "transcript.partial" && typeof msg.text === "string") {
        setPartialTranscript(msg.text);
      } else if (msg.type === "transcript.completed" && typeof msg.text === "string") {
        setPartialTranscript("");
        setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: msg.text }]);
      }

      // Some models stream text via response.delta / response.completed
      if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
        setPartialTranscript((p) => p + msg.delta);
      } else if (msg.type === "response.completed" && msg.response?.output_text) {
        setPartialTranscript("");
        const full = Array.isArray(msg.response.output_text)
          ? msg.response.output_text.join("")
          : String(msg.response.output_text || "");
        if (full.trim()) {
          setTranscript((old) => [...old, { id: msg.id || crypto.randomUUID(), text: full }]);
        }
      }
    } catch (e) {
      // non-JSON messages get ignored
    }
  };

  // ---- public API ----
  const connect = useCallback(async ({ token, model }) => {
    try {
      if (isConnected || status === "connecting") return;
      setStatus("connecting");
      setLastError(null);
      tokenRef.current = token;
      modelRef.current = model;

      // 1) Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 2) Remote audio playback
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        const el = ensureAudioElement();
        el.srcObject = stream;
        el.play().catch(() => {});
        setupSpeakingDetector(stream);
      };

      // 3) Data channels
      pc.ondatachannel = (e) => {
        recvDCRef.current = e.channel;
        recvDCRef.current.onmessage = handleServerEvent;
      };
      sendDCRef.current = pc.createDataChannel("oai-events");
      sendDCRef.current.onopen = () => log("send channel open");

      // 4) We want to send mic and receive audio
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // 5) Get mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setIsListening(true);

      // 6) Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7) Exchange SDP with OpenAI Realtime using ephemeral token
      const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(modelRef.current)}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenRef.current}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
        body: offer.sdp,
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Realtime SDP exchange failed: ${errText}`);
      }
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("connected");
      setIsConnected(true);
      log("connected to OpenAI Realtime");
    } catch (e) {
      console.error(e);
      setLastError(String(e?.message || e));
      setStatus("idle");
      setIsConnected(false);
      setIsListening(false);
      teardownSpeakingDetector();
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
    }
  }, [isConnected, status]);

  const disconnect = useCallback(() => {
    setStatus("disconnecting");
    try {
      if (sendDCRef.current) {
        try { sendDCRef.current.close(); } catch {}
        sendDCRef.current = null;
      }
      if (recvDCRef.current) {
        try { recvDCRef.current.close(); } catch {}
        recvDCRef.current = null;
      }
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
    } finally {
      setIsConnected(false);
      setIsListening(false);
      setStatus("idle");
      teardownSpeakingDetector();
    }
  }, []);

  // Send a text message (the model will reply with speech over the audio track)
  const sendText = useCallback((text) => {
    if (!sendDCRef.current || sendDCRef.current.readyState !== "open") return;
    const evt1 = { type: "input_text.append", text };
    const evt2 = { type: "response.create" };
    try {
      sendDCRef.current.send(JSON.stringify(evt1));
      sendDCRef.current.send(JSON.stringify(evt2));
      if (DEBUG) log("sent:", evt1, evt2);
    } catch (e) {
      setLastError(String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      try { disconnect(); } catch {}
      if (audioElRef.current) {
        try { audioElRef.current.srcObject = null; } catch {}
        try { audioElRef.current.remove(); } catch {}
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
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
