🧠 CLAUDE – VOICE LOOP CODE REVIEW TASK

You are reviewing a fully isolated set of files that power a real-time voice AI assistant (like ChatGPT Voice Mode).

---

🎯 OBJECTIVE:
Make this work as a smooth, deployable assistant that:
1. Accepts mic input
2. Sends audio to OpenAI Whisper
3. Streams or sends transcript to GPT
4. Returns assistant reply
5. Synthesizes and plays the reply via ElevenLabs or OpenAI TTS
6. Feels fast, clean, and user-friendly

---

📂 FILES INCLUDED:

**Client Side**
- `DurmahWidget.tsx` → start/stop button
- `useRealtimeWebRTC.js` → voice logic
- `useChat.js` → shared state (if used)

**Server Side**
- `realtime.js` → provides OpenAI connection token
- `voice.js` → (optional control route)
- `realtime-voice.js` → OpenAI pipeline (ASR → GPT → TTS)
- `socket.js` → (optional transcript pusher)

---

🔧 SUGGESTIONS:
- Ensure clean playback of TTS audio
- Add fallback if mic not available
- Improve toggle UX and error messages
- Minimize latency between mic input and reply playback

---

📦 OUTPUT:
Once reviewed, help optimize and fill missing logic in-place (using Claude Code), or comment where critical wiring is missing.
