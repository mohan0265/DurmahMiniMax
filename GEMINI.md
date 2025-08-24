# GEMINI.md

## 🔊 Project: Durmah Voice Loop – MyDurhamLaw Assistant

### 🧠 Purpose
This repository powers the **Durmah Voice Widget**, a real-time voice-enabled AI companion for law students at Durham University (and eventually other universities). Inspired by ChatGPT’s Voice Mode, Durmah offers intelligent, time-aware, memory-based support for:

- Academic planning
- Study advice
- Law concepts Q&A
- Assignment feedback
- Wellbeing check-ins
- Calendar and syllabus awareness

---

### 🎯 End Goal

Build a **single-click, real-time Voice Mode experience** within a floating widget that:
- Activates only when the student chooses to engage
- Starts with a warm, context-aware greeting
- Responds naturally to student voice prompts
- Transcribes in the background (only shown after chat ends)
- Evolves over time with the student’s journey (e.g., term schedule awareness)
- Fully backed by Google Sign-In via Supabase Auth

---

### 🔐 Authentication
- Only **Google Auth** is allowed (via Supabase)
- All app features and pages are locked behind login
- Durmah widget should **respect auth context**, but not auto-connect

---

### 🧱 Key Components

- `DurmahWidget.jsx`: Floating voice button widget, triggers chat session
- `useRealtimeVoice.js`: Handles WebRTC mic stream and ElevenLabs/OpenAI integration
- `VoiceContext.jsx`: Global state for voice/chat session
- `ChatBubble.tsx`, `ChatInput.tsx`: Optional transcript display (hidden during chat)
- `AuthContext.tsx`: Manages login state
- `App.jsx` / `Header.jsx`: Should include fallback routing and loading guardrails

---

### 🤖 Expected AI Behavior (Durmah)
- Personalised greeting: “Hi Priya, good morning. How are you feeling today?”
- Greeting should change by **time of day** and **day of the week**
- Avoid robotic intros (“Hi, I’m Durmah”) after first use
- Be aware of term schedule, upcoming classes, and assignment due dates
- Respect privacy: Only display transcripts **after** chat ends

---

### 🛠️ Tech Stack
- Vite + React
- Supabase (Auth, DB, RLS)
- OpenAI + ElevenLabs for real-time voice
- Netlify for deployment

---

### ✅ What Gemini Should Preserve
- Google-only Auth (Supabase)
- Clean routing logic (protect routes behind login)
- Durmah only connects on click, not auto
- Personalised AI chat behavior
- Transcript hidden during chat
- Modular code organization
- App should behave like **ChatGPT Voice Mode**

---

### 👤 Developer
Founder & Developer: M Chandramohan  
Vision: Build ethical, intelligent voice companions for real-time learning and wellbeing support.

---

