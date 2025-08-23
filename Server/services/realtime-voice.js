// Server/services/realtime-voice.js
const OpenAI = require("openai");
const { WebSocketServer } = require("ws");
const WebSocket = require("ws");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Debug flags
const VOICE_LOOPBACK = process.env.VOICE_LOOPBACK === 'true';
const DEBUG_VOICE = process.env.DEBUG_VOICE === 'true' || VOICE_LOOPBACK;

class RealtimeVoiceService {
  constructor() {
    this.connections = new Map();
    this.loopbackBuffers = new Map(); // Store mic audio for loopback
    
    if (VOICE_LOOPBACK) {
      console.log('🔄 VOICE LOOPBACK MODE ENABLED - Audio will echo back without OpenAI');
    }
    if (DEBUG_VOICE) {
      console.log('🐛 DEBUG_VOICE enabled - Enhanced logging active');
    }
  }

  // Keep sockets alive
  attachHeartbeat(socket, label) {
    socket.isAlive = true;
    socket.on("pong", () => (socket.isAlive = true));

    const interval = setInterval(() => {
      if (socket.isAlive === false) {
        console.warn(`[HB] ${label} timed out; terminating`);
        try { socket.terminate(); } catch {}
        clearInterval(interval);
        return;
      }
      socket.isAlive = false;
      try { socket.ping(); } catch {}
    }, 25000);

    socket.on("close", () => clearInterval(interval));
    socket.on("error", () => clearInterval(interval));
  }

  initWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: "/voice" });

    wss.on("connection", (ws) => {
      console.log("🎙️ Client connected");
      const connectionId = Math.random().toString(36).slice(2, 11);
      this.attachHeartbeat(ws, "client");
      this.initRealtimeSession(ws, connectionId);

      ws.on("close", () => {
        console.log("🎙️ Client disconnected");
        const conn = this.connections.get(connectionId);
        if (conn?.realtimeWs) try { conn.realtimeWs.close(); } catch {}
        this.connections.delete(connectionId);
      });

      ws.on("error", (e) => console.error("Client WS error:", e));
    });

    return wss;
  }

  async initRealtimeSession(ws, connectionId) {
    try {
      if (DEBUG_VOICE) {
        console.log(`🔧 [${connectionId}] Initializing realtime session (loopback: ${VOICE_LOOPBACK})`);
      }

      this.connections.set(connectionId, { 
        ws, 
        realtimeWs: null,
        loopbackBuffer: [],
        lastLoopbackTime: 0
      });

      // Loopback mode - skip OpenAI connection
      if (VOICE_LOOPBACK) {
        this.initLoopbackMode(ws, connectionId);
        return;
      }

      const realtimeWs = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );

      this.connections.get(connectionId).realtimeWs = realtimeWs;

      realtimeWs.on("open", () => {
        if (DEBUG_VOICE) {
          console.log(`🤖 [${connectionId}] Connected to OpenAI Realtime API`);
        } else {
          console.log("🤖 Connected to OpenAI Realtime");
        }
        this.attachHeartbeat(realtimeWs, "openai");

        const sessionUpdate = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: this.getDurmahInstructions(),
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        };
        
        if (DEBUG_VOICE) {
          console.log(`🔧 [${connectionId}] Sending session config:`, JSON.stringify(sessionUpdate, null, 2));
        }
        
        try { 
          realtimeWs.send(JSON.stringify(sessionUpdate)); 
          if (DEBUG_VOICE) {
            console.log(`✅ [${connectionId}] Session config sent successfully`);
          }
        } catch (err) {
          console.error(`❌ [${connectionId}] Failed to send session config:`, err);
        }

        if (ws.readyState === 1) {
          const readyMessage = {
            type: "durmah.ready",
            message: "Hello! I'm Durmah, your Legal Eagle Buddy. I'm listening and ready to help. 💜",
          };
          ws.send(JSON.stringify(readyMessage));
          if (DEBUG_VOICE) {
            console.log(`📢 [${connectionId}] Sent ready message to client`);
          }
        }
      });

      // Forward ALL JSON messages from client → OpenAI
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data);
          
          if (DEBUG_VOICE) {
            if (msg.type === 'input_audio_buffer.append') {
              console.log(`🎤 [${connectionId}] Client audio chunk: ${msg.audio ? msg.audio.length : 'no audio'} bytes`);
            } else {
              console.log(`📨 [${connectionId}] Client message:`, msg.type, Object.keys(msg).filter(k => k !== 'audio'));
            }
          }
          
          // Legacy mapping support
          if (msg.type === "audio.input") {
            const forwardMsg = {
              type: "input_audio_buffer.append",
              audio: msg.audio,
            };
            realtimeWs.send(JSON.stringify(forwardMsg));
            if (DEBUG_VOICE) {
              console.log(`🔄 [${connectionId}] Mapped legacy audio.input to input_audio_buffer.append`);
            }
          } else {
            // Forward all types verbatim (append, commit, response.create, etc.)
            realtimeWs.send(JSON.stringify(msg));
            if (DEBUG_VOICE && msg.type !== 'input_audio_buffer.append') {
              console.log(`➡️ [${connectionId}] Forwarded to OpenAI:`, msg.type);
            }
          }
        } catch (e) {
          console.error(`❌ [${connectionId}] Client message parse error:`, e);
        }
      });

      // Forward selected OpenAI events → client with audio protocol standardization
      let currentReplyTranscript = "";
      let hasActiveAudioResponse = false;
      
      realtimeWs.on("message", (data) => {
        try {
          // OpenAI sometimes emits binary frames; normalize to string
          let text;
          if (Buffer.isBuffer(data)) {
            text = data.toString("utf8");
          } else if (typeof data === "string") {
            text = data;
          } else {
            if (DEBUG_VOICE) {
              console.log(`⚠️ [${connectionId}] Ignoring non-string OpenAI message:`, typeof data);
            }
            return; // ignore
          }

          const msg = JSON.parse(text);
          
          if (DEBUG_VOICE) {
            if (msg.type === 'response.audio.delta') {
              console.log(`🎵 [${connectionId}] OpenAI audio delta: ${msg.delta ? msg.delta.length : 'no delta'} bytes`);
            } else if (msg.type === 'response.audio_transcript.delta') {
              console.log(`📝 [${connectionId}] OpenAI transcript delta: "${msg.delta || ''}"`);
            } else {
              console.log(`📥 [${connectionId}] OpenAI message:`, msg.type, Object.keys(msg).filter(k => !['delta', 'audio'].includes(k)));
            }
          }
          
          // Handle different message types with standardized audio protocol
          switch (msg.type) {
            case "response.audio.delta":
              // Convert OpenAI audio delta to standardized format
              if (msg.delta && ws.readyState === 1) {
                if (!hasActiveAudioResponse) {
                  hasActiveAudioResponse = true;
                  const logMsg = DEBUG_VOICE ? 
                    `🎵 [${connectionId}] Starting audio response (first chunk: ${msg.delta.length} bytes)` :
                    "🎵 Starting audio response";
                  console.log(logMsg);
                }
                const audioChunk = {
                  type: "audio_chunk",
                  sampleRate: 24000,
                  pcm16: msg.delta
                };
                ws.send(JSON.stringify(audioChunk));
                if (DEBUG_VOICE) {
                  console.log(`📤 [${connectionId}] Sent audio_chunk to client: ${msg.delta.length} bytes`);
                }
              } else if (DEBUG_VOICE) {
                console.log(`⚠️ [${connectionId}] Skipping audio delta - no delta data or ws not ready`);
              }
              break;

            case "response.audio_transcript.delta":
              // Buffer transcript until audio finishes
              if (msg.delta) {
                currentReplyTranscript += msg.delta;
              }
              break;

            case "response.audio.done":
              // Signal end of audio stream
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: "audio_end" }));
                console.log("🎵 Audio response finished");
              }
              hasActiveAudioResponse = false;
              break;

            case "response.done":
              // Send buffered transcript after audio is complete
              if (ws.readyState === 1) {
                if (currentReplyTranscript.trim()) {
                  ws.send(JSON.stringify({
                    type: "transcript",
                    text: currentReplyTranscript.trim()
                  }));
                  console.log("📝 Transcript sent:", currentReplyTranscript.trim().substring(0, 50) + "...");
                }
                ws.send(JSON.stringify(msg)); // Forward response.done
              }
              currentReplyTranscript = "";
              hasActiveAudioResponse = false;
              break;

            case "input_audio_buffer.speech_started":
            case "input_audio_buffer.speech_stopped":
            case "input_audio_buffer.committed":
            case "conversation.item.input_audio_transcription.completed":
            case "response.output_item.added":
            case "response.content_part.added":
            case "conversation.item.created":
            case "error":
              // Forward these events as-is
              if (ws.readyState === 1) {
                ws.send(JSON.stringify(msg));
              }
              break;

            default:
              // Log unhandled message types for debugging
              console.log("🔍 Unhandled OpenAI message:", msg.type);
              break;
          }

          if (msg.type === "conversation.item.created") {
            console.log(
              "💬 item:",
              msg.item?.content?.[0]?.text ? "text" : "audio"
            );
          }
        } catch (e) {
          console.error("OpenAI message error:", e);
        }
      });

      realtimeWs.on("error", (e) => {
        console.error("OpenAI Realtime error:", e);
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              type: "error",
              message:
                "Voice service temporarily unavailable. Please try text chat.",
            })
          );
        }
      });

      realtimeWs.on("close", () => {
        console.log("🤖 OpenAI Realtime closed");
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Voice service temporarily unavailable",
            })
          );
        }
      });
    } catch (e) {
      console.error("Init realtime session error:", e);
      try {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Failed to initialize voice service",
          })
        );
      } catch {}
    }
  }

  // Loopback mode - echo mic audio back to client
  initLoopbackMode(ws, connectionId) {
    console.log(`🔄 [${connectionId}] Initializing loopback mode`);
    
    // Send ready message immediately
    if (ws.readyState === 1) {
      const readyMessage = {
        type: "durmah.ready",
        message: "🔄 Loopback mode active! I'll echo your voice back to test the audio pipeline.",
      };
      ws.send(JSON.stringify(readyMessage));
      console.log(`📢 [${connectionId}] Sent loopback ready message`);
    }

    // Handle client messages in loopback mode
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data);
        const conn = this.connections.get(connectionId);
        
        if (!conn) return;

        if (DEBUG_VOICE) {
          console.log(`📨 [${connectionId}] Loopback client message:`, msg.type);
        }

        // Handle audio input for loopback
        if (msg.type === "input_audio_buffer.append" && msg.audio) {
          console.log(`🎤 [${connectionId}] Loopback received audio chunk: ${msg.audio.length} bytes`);
          
          // Buffer the audio
          conn.loopbackBuffer.push({
            audio: msg.audio,
            timestamp: Date.now()
          });

          // Check if we have enough audio (aim for 500-800ms at 24kHz PCM16)
          // 24kHz * 2 bytes/sample * 0.5-0.8 seconds = 24000-38400 bytes
          const totalBytes = conn.loopbackBuffer.reduce((sum, chunk) => sum + chunk.audio.length, 0);
          const timeSinceFirst = Date.now() - (conn.loopbackBuffer[0]?.timestamp || Date.now());
          
          if (totalBytes >= 24000 || timeSinceFirst >= 800) {
            this.processLoopbackAudio(ws, connectionId);
          }
        }
        
        // Handle commit - trigger immediate echo
        else if (msg.type === "input_audio_buffer.commit") {
          console.log(`🔄 [${connectionId}] Loopback commit triggered`);
          this.processLoopbackAudio(ws, connectionId);
        }
        
        // Handle response creation (just acknowledge)
        else if (msg.type === "response.create") {
          if (DEBUG_VOICE) {
            console.log(`🔄 [${connectionId}] Loopback response.create acknowledged`);
          }
        }

      } catch (e) {
        console.error(`❌ [${connectionId}] Loopback message error:`, e);
      }
    });
  }

  // Process accumulated loopback audio and echo it back
  processLoopbackAudio(ws, connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn || conn.loopbackBuffer.length === 0) return;

    console.log(`🔄 [${connectionId}] Processing loopback audio: ${conn.loopbackBuffer.length} chunks`);

    // Concatenate all buffered audio
    const combinedAudio = conn.loopbackBuffer.map(chunk => chunk.audio).join('');
    
    // Clear the buffer
    conn.loopbackBuffer = [];

    if (ws.readyState === 1) {
      // Send the audio back as response chunks
      const chunkSize = 1200; // Smaller chunks for smoother playbook
      for (let i = 0; i < combinedAudio.length; i += chunkSize) {
        const chunk = combinedAudio.slice(i, i + chunkSize);
        
        setTimeout(() => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "audio_chunk",
              sampleRate: 24000,
              pcm16: chunk
            }));
          }
        }, (i / chunkSize) * 50); // 50ms delay between chunks
      }

      // Send audio end after all chunks
      setTimeout(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "audio_end" }));
          console.log(`🎵 [${connectionId}] Loopback audio playbook complete`);
        }
      }, Math.ceil(combinedAudio.length / chunkSize) * 50 + 100);

      // Send test transcript
      setTimeout(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "transcript",
            text: `[Loopback test - echoed ${Math.round(combinedAudio.length / 48)} bytes of audio]`
          }));
          console.log(`📝 [${connectionId}] Sent loopback transcript`);
        }
      }, Math.ceil(combinedAudio.length / chunkSize) * 50 + 200);
    }
  }

  getDurmahInstructions() {
    return `You are Durmah, the compassionate Legal Eagle Buddy for Durham Law students.

🦅 CORE:
- Warm, supportive, encouraging
- Knowledgeable about UK law & Durham University
- Voice‑first, emotionally intelligent

💜 TONE:
- Natural, gentle, brief (1–3 sentences usually)
- Check wellbeing proactively

📚 EXPERTISE:
- UK legal system, case law, exam & study skills, stress management

⚖️ STYLE:
- Ask clarifying questions
- Offer concrete next steps

🚨 BOUNDARIES:
- Educational support only; not legal advice
- For crisis, recommend professional help`;
  }

  closeAllConnections() {
    for (const [_, c] of this.connections) {
      try { c.realtimeWs?.close(); } catch {}
      try { c.ws?.close(); } catch {}
    }
    this.connections.clear();
  }
}

module.exports = new RealtimeVoiceService();
