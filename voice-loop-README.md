# 🧠 VOICE LOOP FILES – Real-Time AI Assistant System

This folder contains the **core voice interaction loop** for a ChatGPT-style AI assistant. Once deployed with correct environment variables, it enables:

🎤 Mic Input → OpenAI Whisper/Chat → 🗣️ TTS Response → Audio Playback

---

## ✅ FILE STRUCTURE

```
Client/
└── src/
    ├── components/
    │   └── DurmahWidget.tsx       ← UI toggle for voice mode
    └── hooks/
        ├── useRealtimeWebRTC.js   ← Mic capture + WebRTC + TTS playback
        └── useChat.js             ← Optional: state handling, transcript
Server/
├── routes/
│   ├── realtime.js                ← POST /api/realtime/session (OpenAI key)
│   └── voice.js                   ← Optional routing for voice control
└── services/
    ├── realtime-voice.js          ← OpenAI & ElevenLabs voice logic
    └── socket.js                  ← (Optional) transcript events
```

---

## 🌐 DEPLOYMENT REQUIREMENTS

| Env Variable               | Purpose                         |
|---------------------------|---------------------------------|
| `OPENAI_API_KEY`          | Used for Whisper + Chat + TTS   |
| `ELEVENLABS_API_KEY`      | (Optional) For TTS synthesis    |
| `VITE_SESSION_ENDPOINT`   | Frontend URL to `realtime.js`   |
| `VITE_ALLOW_ANON_VOICE`   | Set to `true` to allow testing  |
| `VITE_REQUIRE_LOGIN`      | Set to `false` if no auth yet   |

---

## 🚀 TO RUN LOCALLY

**Client**
```bash
cd Client
npm install
npm run dev
```

**Server**
```bash
cd Server
npm install
node index.js
```

Then open `http://localhost:5173`

---

## 🧪 TEST WITH CLAUDE CODE

You can ask Claude:
- “What does `useRealtimeWebRTC.js` do?”
- “Can you improve `DurmahWidget.tsx` to support live transcript preview?”
- “Where should I insert speaker audio playback?”
- “Make this as fast and natural as ChatGPT Voice.”

