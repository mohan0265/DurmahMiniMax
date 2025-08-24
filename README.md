Final README.md (Replace existing if needed)
# 🧠🗣️ Durmah Voice Loop – ChatGPT Voice Mode Clone

A production-grade, real-time voice loop widget inspired by OpenAI ChatGPT Voice Mode. Built with OpenAI, ElevenLabs, Supabase, and deployed using Render + Netlify.

---

## 🚀 Features

- 🎙️ One-click **Voice Mode Activation**
- 🔄 Real-time streaming with OpenAI + ElevenLabs
- 🔐 Google OAuth-only authentication (no email/password login)
- 🧠 Memory & integrity layer (optional JWT, Supabase RLS)
- 📱 Fully responsive (mobile-ready)
- 🛠️ Production-ready: `Dockerfile`, `render.yaml`, `netlify.toml`, `.env`

---

## 🧰 Tech Stack

| Layer       | Tech                     |
|-------------|--------------------------|
| Frontend    | React + Tailwind         |
| Voice AI    | OpenAI Whisper + ElevenLabs |
| Backend     | Node.js (Express)        |
| Auth & DB   | Supabase                 |
| Hosting     | Render (server) + Netlify (client) |

---

## 🔐 Authentication

**Google OAuth Only**: This application uses Google OAuth exclusively for authentication. No email/password login is supported.

- Users must sign in with their Google account
- Durham University email addresses (@durham.ac.uk) automatically receive voice access
- Clean, secure authentication flow with no password management required

---

## 🔧 Environment Variables

Create `.env.local` in `/Server` based on `.env.example`.

| Variable                    | Purpose                          |
|----------------------------|----------------------------------|
| `OPENAI_API_KEY`           | For transcription (Whisper)      |
| `ELEVENLABS_API_KEY`       | For TTS voice output             |
| `SUPABASE_URL`             | Supabase project URL             |
| `SUPABASE_SERVICE_ROLE_KEY`| For server-side Supabase access  |
| `ALLOWED_ORIGINS`          | CORS policy                      |
| `JWT_SECRET`               | Enable JWT-auth (optional)       |
| `PORT`                     | Server port (default: `3001`)    |
| `DEBUG_VOICE`              | Set `true` to see logs           |

---

## 🔨 Local Dev Instructions

```bash
# Install dependencies
npm install --prefix Client
npm install --prefix Server

# Start development server
npm run dev --prefix Client
npm run dev --prefix Server

🧪 Live Deployment Setup

Server: Deployed on Render
 using render.yaml

Client: Deployed on Netlify
 using netlify.toml

Add your environment variables under Render/Netlify project settings

📂 Folder Structure
DurmahMiniMax/
├── Client/              # React Frontend
│   ├── src/             # Voice hook, context, UI
│   ├── index.html
│   └── vite.config.js
├── Server/              # Node.js backend
│   ├── routes/          # Realtime, voice API
│   ├── services/        # Integrity, memory, socket
│   └── Dockerfile
├── .env.example
├── render.yaml
├── netlify.toml
└── README.md

📘 Related Docs

voice-loop-README.md
 – Technical implementation notes

voice-loop-ClaudePrompt.md
 – Prompt used to build this voice loop

INTEGRATION_SUMMARY.md
 – Notes for integration into MyDurhamLaw

DEPLOYMENT.md
 – Hosting setup instructions

🧠 Future Roadmap

 Claude/GPT auto mode switching (text vs voice)

 Continuous voice conversations (multi-turn UX)

 Browser tab wake/sleep awareness

 Emotion detection & Wellbeing tracking (from original Durmah project)

🫡 Credits

Built by mohan0265

In collaboration with Claude and ChatGPT