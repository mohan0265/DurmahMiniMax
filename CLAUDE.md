# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Durmah is a compassionate AI companion for Durham Law students featuring real-time voice interaction, wellbeing support, and educational assistance. The application centers around a floating widget interface that provides 24/7 AI chat support with speech recognition and text-to-speech capabilities.

## Architecture

### Core System Design
The application follows a client-server architecture with real-time communication:

**Frontend (Client/)**: React/Vite SPA with global floating widget
- `App.jsx` - Main application with conditional FloatingWidget mounting
- `FloatingWidget.jsx` - Primary interface with voice I/O and chat
- `AuthContext.jsx` - Supabase authentication with OAuth handling
- `useChat.js` - Chat state management with Supabase JWT authentication

**Backend (Server/)**: Express API with OpenAI integration
- `routes/chat.js` - Chat endpoints with conversation management
- `services/openai.js` - GPT-4o-mini integration with Durmah personality
- Handles authentication via Supabase JWT tokens

**Database**: Supabase PostgreSQL with comprehensive schema
- User profiles, conversations, mood tracking, study progress
- Row Level Security (RLS) policies for data protection
- Schema defined in `database/schema.sql`

### Authentication Flow
- Google OAuth via Supabase with automatic redirect to `/dashboard`
- Session persistence with JWT tokens (not localStorage)
- OAuth parameters cleaned from URL after successful authentication
- Smart routing prevents login loops

### Widget Architecture Pattern
The FloatingWidget is mounted globally in App.jsx when user is authenticated:
```jsx
{user && (
  <ChatProvider>
    <FloatingWidget />
  </ChatProvider>
)}
```

This creates an always-available interface that persists across routes, making it the primary interaction point rather than traditional page-based navigation.

## Development Commands

### Root Level Commands
```bash
npm run install:all          # Install dependencies for all packages
npm run dev                  # Start both client (3000) and server (3001)
npm run build                # Build both client and server for production
npm run test                 # Run tests for both client and server
```

### Client-Specific (from Client/ directory)
```bash
npm run dev                  # Vite dev server on port 3000
npm run build                # Production build to dist/
npm run preview              # Preview production build
npm run lint                 # ESLint (fixed --ext flag removed)
npm test                     # Run client tests
```

### Server-Specific (from Server/ directory)
```bash
npm run dev                  # Nodemon development server on port 3001
npm start                    # Production server
npm test                     # Run server tests with Jest
```

## Environment Configuration

### Critical Environment Variables
**Client (.env):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_API_URL` - Backend server URL (defaults to localhost:3001)

**Server (.env in root):**
- `OPENAI_API_KEY` - Required for AI responses
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `CLIENT_URL` - Frontend URL for CORS

The application includes environment validation with helpful error messages. See `ENVIRONMENT_SETUP.md` for detailed configuration.

## Voice Integration Architecture

### Speech Recognition
- Uses native Web Speech API (`window.SpeechRecognition`)
- Activated via microphone button with pulsating animation
- Transcribed text populates message input automatically
- Graceful fallback for unsupported browsers

### Text-to-Speech
- Uses Web Speech API (`window.speechSynthesis`)
- Automatically speaks AI responses when chat is open
- Attempts to use female voice for Durmah character
- Manual speech cancellation available

### Implementation Pattern
Voice features are initialized in FloatingWidget useEffect:
```jsx
useEffect(() => {
  // Initialize speech recognition and synthesis
  // Set up event handlers for start/end/error
  // Auto-speak AI responses
}, []);
```

## AI Personality Integration

### Durmah Character Design
The OpenAI service implements a detailed system prompt that defines Durmah as:
- Warm, supportive Legal Eagle Buddy for Durham Law students
- UK law and Durham University contextual knowledge
- Wellbeing-aware with crisis detection capabilities
- Educational boundaries (no professional legal advice)

### Response Patterns
- Conversational but informative tone
- Natural emoji usage
- Proactive wellbeing check-ins
- Case law examples and study guidance
- Maximum 300 tokens to maintain conversational flow

## Testing and Deployment

### Pre-deployment Validation
Key areas to test before deployment:
- Authentication flow (Google OAuth → dashboard → widget appears)
- Voice recognition and TTS functionality (requires HTTPS in production)
- Chat message flow with AI responses
- Environment variable loading and validation
- Mobile responsiveness and cross-browser compatibility

### Deployment Architecture
- **Frontend**: Netlify with `Client/` as build directory
- **Backend**: Fly.io or Railway with existing Dockerfile
- **Database**: Supabase with RLS policies applied
- **Domain**: OAuth redirect URLs must match deployment URLs

### Production Considerations
- HTTPS required for speech recognition in production browsers
- CORS configuration must allow deployed frontend domain
- Supabase environment variables required in both client and server
- Build process validates environment configuration

## Development Patterns

### State Management
- AuthContext for global authentication state
- ChatContext for chat-specific state (conversations, active chat)
- Individual component state for UI interactions (widget open/closed, voice recording)

### Error Handling Philosophy
- Graceful degradation (offline mode for chat, fallback responses)
- User-friendly error messages via toast notifications
- Console logging for debugging without exposing sensitive info
- Fallback UI states for loading and error conditions

### Component Architecture
- FloatingWidget as primary interface (not dashboard-centric)
- Dashboard serves as welcome screen directing users to widget
- Modular hook-based state management (`useChat`, `useAuth`)
- Responsive design with Tailwind CSS and Framer Motion animations

The application prioritizes the floating widget experience over traditional page-based navigation, creating a companion-like interface that's always accessible to students.
