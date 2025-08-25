// Client/src/hooks/useRealtimeWebRTC.js
// Failsafe: always receive & play the OpenAI remote audio stream.
// Adds aggressive audio "unlock" + force play on 'track' so you hear replies.

import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG =
  import.meta.env.VITE_DEBUG_VOICE === "true" ||
  (typeof window !== "undefined" && window.location.search.includes("debug=voice"));

export function useRealtimeWebRTC() {
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);

  const audioElRef = useRef(null);
  const dcRef = useRef(null);

  const audioCtxRef = useRef(null);
  const vadRemoteRef = useRef({ alive: false, raf: 0 });

  const [status, setStatus] = useState("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [partialTranscript, setPartialTranscript] = useState("");

  // track if assistant is mid-reply (for gentle barge-in)
  const activeResponseRef = useRef(false);
  const replyBufferRef = useRef("");

  const log = (...a) => { if (DEBUG) console.log("[RealtimeWebRTC]", ...a); };

  const ensureAudioElement = () => {
    if (!audioElRef.current) {
      const el = document.createElement("audio");
      el.autoplay = true;
      el.playsInline = true;
      el.muted = false;
      el.volume = 1.0;
      el.crossOrigin = "anonymous";
      el.setAttribute("playsinline", "");
      audioElRef.current = el;
      document.body.appendChild(el);
    }
    return audioElRef.current;
  };

  const startRemotePulse = (remoteStream) => {
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

  const flushReply = (idHint) => {
    const full = replyBufferRef.current.trim();
    replyBufferRef.current = "";
    if (full) {
      setPartialTranscript("");
      setTranscript((old) => [...old, { id: idHint || crypto.randomUUID(), text: full }]);
      setIsSpeaking(true);
    }
    activeResponseRef.current = false;
  };

  const handleServerEvent = (evt) => {
    let msg; try { msg = JSON.parse(evt.data); } catch { return; }
    if (DEBUG) log("recv:", msg);

    if (msg.type === "error") { setLastError(msg.error?.message || "Server error"); activeResponseRef.current = false; return; }
    if (msg.type === "rate_limits.updated") return;

    // User speech -> transcript
    if (msg.type === "transcript.partial" && typeof msg.text === "string") {
      setPartialTranscript(msg.text);
      return;
    }
    if (msg.type === "transcript.completed" && typeof msg.text === "string") {
      setPartialTranscript("");
      setTranscript((o) => [...o, { id: msg.id || crypto.randomUUID(), text: msg.text }]);
      return;
    }

    // Assistant text -> accumulate so we can show it too
    if (msg.type === "response.created" || msg.type === "conversation.item.created") {
      activeResponseRef.current = true;
      replyBufferRef.current = "";
      return;
    }
    if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
      replyBufferRef.current += msg.delta;
      setPartialTranscript((p) => p + msg.delta);
      activeResponseRef.current = true;
      return;
    }
    if (msg.type === "response.output_text.done") return;

    // IMPORTANT: some variants send "response.done" instead of "response.completed"
    if (msg.type === "response.completed" || msg.type === "response.done") {
      flushReply(msg.response?.id || msg.id);
      return;
    }
  };

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

      // HARD-PLAY of remote audio
      pc.ontrack = (e) => {
        const el = ensureAudioElement();
        // Some browsers provide e.streams[0], others only e.track:
        const stream = (e.streams && e.streams[0]) ? e.streams[0] : new MediaStream([e.track]);
        el.srcObject = stream;
        el.muted = false;
        el.volume = 1.0;
        const tryPlay = () => { el.play().catch(() => {}); };
        el.addEventListener("canplay", tryPlay, { once: true });
        tryPlay();
        startRemotePulse(stream);
        if (DEBUG) log("remote audio track attached");
      };

      // One data channel for events
      dcRef.current = pc.createDataChannel("oai-events");
      dcRef.current.onopen = () => { if (DEBUG) log("data channel open"); };
      dcRef.current.onmessage = handleServerEvent;

      // Send mic, receive audio
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // Mic
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

      // gentle barge-in: only cancel if a reply is actually active
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
            let maxDev = 0; for (let i = 0; i < data.length; i++) {
              const v = Math.abs(data[i] - 128); if (v > maxDev) maxDev = v;
            }
            const nowSpeaking = maxDev > 10;
            if (!speaking && nowSpeaking && activeResponseRef.current && dcRef.current?.readyState === "open") {
              try { dcRef.current.send(JSON.stringify({ type: "response.cancel" })); } catch {}
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

      setStatus("connected"); setIsConnected(true);
      if (DEBUG) log("connected");
    } catch (e) {
      console.error(e);
      setLastError(String(e?.message || e));
      try { pcRef.current?.close(); } catch {}
      pcRef.current = null;
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
      stopRemotePulse();
      setIsListening(false);
      setIsConnected(false);
      setStatus("idle");
    }
  }, [isConnected, status]);

  const disconnect = useCallback(() => {
    setStatus("disconnecting");
    try {
      try { dcRef.current?.close(); } catch {}
      dcRef.current = null;
      try { pcRef.current?.close(); } catch {}
      pcRef.current = null;
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
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

  useEffect(() => {
    return () => {
      try { disconnect(); } catch {}
      if (audioElRef.current) {
        try { audioElRef.current.srcObject = null; } catch {}
        try { audioElRef.current.remove(); } catch {}
      }
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
