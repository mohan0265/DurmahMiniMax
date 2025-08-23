# 🦅 Durmah - Voice-Mode Tutor Widget for UK Law Students

> **Your compassionate AI companion for Durham Law School success with ChatGPT-grade voice interaction**

Built with love for every Durham law student who needs support, encouragement, and expertise on their journey. Now featuring ultra-low-latency voice interaction that responds faster than ChatGPT's voice mode.

![Durmah Banner](https://img.shields.io/badge/Built%20with-Love%20%F0%9F%92%9C-purple)
![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Voice Mode](https://img.shields.io/badge/Voice%20Mode-Ultra%20Low%20Latency-green)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌟 New Voice Features

### Voice-First Interaction
- **Ultra-Low Latency**: First audio response <1200ms (faster than ChatGPT Voice Mode)
- **Instant Barge-In**: Interrupt and pivot conversations <300ms
- **One-Click Voice**: Floating button → instant voice conversation
- **Real-Time Transcription**: Live captions with partial and final transcripts
- **WebRTC Direct Connection**: Bypass servers for minimal latency
- **Smart Fallbacks**: WebSocket backup + SpeechSynthesis TTS fallback

### Drop-In Widget
- **Universal Integration**: Works with any React/Next.js application
- **Floating Interface**: Non-intrusive floating button that expands to voice panel
- **Accessibility First**: ARIA labels, keyboard navigation, screen reader support
- **Mobile Optimized**: Touch-friendly controls for study-on-the-go
- **Status Indicators**: Clear visual feedback (listening/speaking/thinking)

## 🚀 Quick Start

### Live Demo
**🌐 Try Durmah Now: [https://pc3qe8ntf0ei.space.minimax.io](https://pc3qe8ntf0ei.space.minimax.io)**

1. Click the floating voice button (bottom-right)
2. Grant microphone permission when prompted
3. Start talking - Durmah responds in real-time!
4. Try interrupting mid-response to test barge-in functionality

### Widget Integration (1-Liner)
```jsx
// Import and add to any React/Next.js app
import { DurmahWidget } from './components/DurmahWidget';

<DurmahWidget />
```

### Prerequisites
- Node.js 18+
- Render account (for backend)
- Netlify account (for frontend)
- Supabase project with provided schema
- OpenAI API key with Realtime API access
- ElevenLabs API key (optional, for premium TTS)

## 📦 Production Deployment

### 🌐 Architecture Overview
```
GitHub Repo → Render (Backend) ← WebRTC ← Netlify (Frontend)
      ↓                              ↑
  Supabase DB ←────── API calls ──────┘
```

### Step 1: Supabase Database Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create new project
   - Choose region close to users (US East for NA, EU West for Europe)
   - Wait for initialization (2-3 minutes)

2. **Import Database Schema**
   - Navigate to **SQL Editor** in Supabase dashboard
   - Copy contents of `/database/schema.sql`
   - Paste and execute to create all tables and RLS policies

3. **Get API Credentials**
   - Go to **Settings** → **API**
   - Copy: Project URL, Anon key, Service role key

### Step 2: Render Backend Deployment

1. **Create Render Web Service**
   ```bash
   # Go to render.com and sign up
   # Click "New" → "Web Service"
   # Connect GitHub repo: mohan0265/DurmahLegalBuddyGPT
   
   # Service Configuration:
   Name: durmah-backend
   Region: Choose closest to users
   Branch: main
   Root Directory: (leave empty)
   Runtime: Node
   Build Command: cd Server && npm install
   Start Command: cd Server && npm start
   ```

2. **Configure Environment Variables**
   ```bash
   # In Render Dashboard → Environment tab, add:
   
   # Core Configuration
   NODE_ENV=production
   LOG_LEVEL=info
   HEALTHCHECK_PATH=/api/healthz
   
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-openai-key-here
   REALTIME_API_BASE=https://api.openai.com
   REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
   
   # ElevenLabs Configuration
   ELEVENLABS_API_KEY=your-elevenlabs-key-here
   ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
   
   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   
   # CORS Configuration (will update after Netlify deploy)
   ALLOWED_ORIGINS=http://localhost:5173
   
   # Voice Defaults
   DEFAULT_VOICE=alloy
   DEFAULT_SAMPLE_RATE=24000
   
   # Security
   JWT_SECRET=generate-32-character-random-string
   SESSION_SECRET=generate-another-32-character-string
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

3. **Deploy and Test**
   ```bash
   # Click "Create Web Service" and wait for deployment
   # Note your backend URL: https://your-service.onrender.com
   
   # Test health check:
   curl https://your-service.onrender.com/api/healthz
   # Should return: {"status":"ok",...}
   ```

### Step 3: Netlify Frontend Deployment

1. **Create Netlify Site**
   ```bash
   # Go to netlify.com and sign up
   # Click "Add new site" → "Import an existing project"
   # Connect GitHub and select: mohan0265/DurmahLegalBuddyGPT
   
   # Build Settings:
   Base directory: (leave empty)
   Build command: cd Client && npm install && npm run build
   Publish directory: Client/dist
   Production branch: main
   ```

2. **Configure Environment Variables**
   ```bash
   # In Netlify: Site settings → Environment variables, add:
   
   # Backend Connection
   VITE_API_BASE=https://your-render-service.onrender.com
   VITE_SESSION_ENDPOINT=/api/realtime/session
   
   # OpenAI Configuration
   VITE_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
   
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   
   # TTS Configuration
   VITE_TTS_PROVIDER=elevenlabs
   
   # App Configuration
   VITE_APP_NAME=Durmah
   VITE_DEBUG_VOICE=false
   VITE_MAX_SESSION_MINUTES=10
   VITE_DEFAULT_VOICE=alloy
   VITE_SAMPLE_RATE=24000
   VITE_ENABLE_CAPTIONS=true
   
   # Feature Flags
   VITE_ENABLE_WIDGET_MODE=true
   VITE_ENABLE_FULLSCREEN_MODE=true
   VITE_ENABLE_MOBILE_OPTIMIZATIONS=true
   
   # Accessibility
   VITE_KEYBOARD_NAV=true
   VITE_HIGH_CONTRAST=false
   VITE_LARGE_TEXT=false
   ```

3. **Deploy and Test**
   ```bash
   # Click "Deploy site" and wait for build
   # Note your frontend URL: https://your-site.netlify.app
   
   # Test deployment:
   curl -I https://your-site.netlify.app
   # Should return: HTTP/2 200
   ```

### Step 4: Final Configuration

1. **Update CORS Origins**
   ```bash
   # Go back to Render dashboard
   # Update ALLOWED_ORIGINS environment variable:
   ALLOWED_ORIGINS=https://your-netlify-site.netlify.app,http://localhost:5173
   
   # Redeploy backend service
   ```

2. **Test Full Integration**
   ```bash
   # Visit your Netlify URL
   # Click floating voice button
   # Grant microphone permission
   # Test voice: "Hello Durmah, help with contract law"
   # Verify <1200ms response time
   # Test barge-in by interrupting response
   ```

3. **Verify Security**
   ```bash
   # Check no sensitive keys in browser:
   # Open dev tools → Network tab → Look at JS bundles
   # Should NOT contain: OPENAI_API_KEY, ELEVENLABS_API_KEY
   # Should contain: VITE_SUPABASE_URL, VITE_API_BASE (safe)
   ```

### Deployment Validation Checklist

- [ ] **Backend Health**: `curl https://your-backend.onrender.com/api/healthz` returns OK
- [ ] **Frontend Loading**: Website loads without errors
- [ ] **Voice Session**: Can create WebRTC session successfully
- [ ] **CORS Working**: No CORS errors in browser console
- [ ] **Database Connected**: Conversations save to Supabase
- [ ] **Performance**: First audio response <1200ms
- [ ] **Barge-in**: Interruption works <300ms
- [ ] **Security**: No API keys in browser bundles
- [ ] **Mobile**: Works on mobile devices with headphones
- [ ] **Monitoring**: Health check endpoint responding

### Backend Deployment (Render)

1. **Create Render Web Service**
   ```bash
   # Connect your GitHub repo to Render
   # Set build command: cd Server && npm install
   # Set start command: cd Server && npm start
   ```

2. **Configure Environment Variables in Render**
   ```bash
   # Copy all variables from Server/.env.example
   # Set in Render Dashboard → Environment
   NODE_ENV=production
   OPENAI_API_KEY=sk-your-key-here
   ELEVENLABS_API_KEY=your-elevenlabs-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE=your-service-key
   ALLOWED_ORIGINS=https://your-netlify-site.netlify.app
   # ... (see Server/.env.example for complete list)
   ```

3. **Health Check Configuration**
   - Render automatically monitors `/api/healthz`
   - No additional configuration needed

### Frontend Deployment (Netlify)

1. **Create Netlify Site**
   ```bash
   # Connect your GitHub repo to Netlify
   # Set build command: cd Client && npm run build
   # Set publish directory: Client/dist
   ```

2. **Configure Environment Variables in Netlify**
   ```bash
   # Set in Netlify Dashboard → Site Settings → Environment Variables
   VITE_API_BASE=https://your-render-service.onrender.com
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   # ... (see Client/.env.example for complete list)
   ```

3. **Build Settings**
   - Build command: `cd Client && npm run build`
   - Publish directory: `Client/dist`
   - Node version: 18+

### Database Setup (Supabase)

1. **Import Schema**
   ```sql
   -- Copy contents of database/schema.sql
   -- Paste into Supabase SQL Editor
   -- Run to create all tables and RLS policies
   ```

2. **Configure RLS Policies**
   - All policies are included in schema.sql
   - No additional configuration needed

## 🛠 Local Development

### One-Line Setup
```bash
# Clone and install everything
git clone https://github.com/mohan0265/DurmahLegalBuddyGPT.git
cd DurmahLegalBuddyGPT && npm run install:all

# Set up environment files
cp Server/.env.example Server/.env
cp Client/.env.example Client/.env
# Edit .env files with your API keys

# Start development servers
npm run dev
```

**Development URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Voice WebSocket: ws://localhost:3001/voice

### Environment Configuration

1. **Server Environment** (`Server/.env`)
   ```bash
   cp Server/.env.example Server/.env
   # Edit with your actual API keys
   ```

2. **Client Environment** (`Client/.env`)
   ```bash
   cp Client/.env.example Client/.env
   # Edit with your local server URL
   ```

## 🎯 How It Works

```
┌─────────────────┐    WebRTC     ┌─────────────────┐
│  React Widget   │◄─────────────►│ OpenAI Realtime │
│                 │               │     API         │
└─────────┬───────┘               └─────────────────┘
          │
          │ Fallback WebSocket
          ▼
┌─────────────────┐    REST/WS    ┌─────────────────┐
│ Render Backend  │◄─────────────►│   Supabase      │
│ (Node.js/Express│               │   Database      │
│  + WebSocket)   │               │                 │
└─────────────────┘               └─────────────────┘
          ▲
          │ TTS Requests
          ▼
┌─────────────────┐
│  ElevenLabs     │
│  Text-to-Speech │
└─────────────────┘
```

### Voice Flow
1. **Session Start**: Widget requests ephemeral key from backend
2. **WebRTC Connection**: Direct connection to OpenAI Realtime API
3. **Audio Streaming**: Real-time bidirectional audio over WebRTC
4. **Barge-In Detection**: Client detects user speech, interrupts current playback
5. **Transcription**: Live transcripts saved to Supabase for context
6. **Fallback**: WebSocket backup if WebRTC fails

## 🔧 Troubleshooting WebRTC & Voice Issues

### Microphone Access Problems

#### Permission Denied
```bash
# Solutions:
1. Ensure HTTPS (required for microphone access)
2. Click the microphone icon in browser address bar
3. Go to Site Settings → Permissions → Microphone → Allow
4. Clear browser cache and cookies, retry
5. Test in incognito/private mode
```

#### Browser-Specific Issues
```bash
# Chrome/Edge: 
- Check chrome://settings/content/microphone
- Ensure site not blocked

# Safari:
- Requires user gesture before audio access
- Go to Safari → Settings → Websites → Microphone
- Set to "Allow" for your domain

# Firefox:
- Check about:config → media.navigator.permission.disabled
- Should be false (default)

# Mobile:
- Use headphones to prevent echo cancellation issues
- Some mobile browsers require tap-to-activate
```

### WebRTC Connection Failures

#### Corporate Networks/Firewalls
```bash
# Corporate firewalls often block WebRTC
# Durmah automatically falls back to WebSocket

# Ports that may be blocked:
- UDP 3478 (STUN)
- TCP/UDP 49152-65535 (RTC data)

# Solutions:
1. Ask IT to allowlist WebRTC traffic
2. Use mobile hotspot to test (bypasses corporate firewall)
3. System will automatically use WebSocket fallback
4. Check browser console for "WebRTC blocked, using WebSocket" message
```

#### TURN Server Issues
```bash
# If WebRTC completely fails:
1. Check TURN server configuration
2. Verify TURN_URL, TURN_USERNAME, TURN_CREDENTIAL in env
3. Test from different network (mobile vs WiFi)
4. Use browser dev tools → Network tab to see connection attempts
```

#### Connection Debugging
```bash
# Enable debug mode:
# Add ?debug=voice to URL or set VITE_DEBUG_VOICE=true

# Check browser console for:
- "WebRTC connection established" ✅
- "Falling back to WebSocket" ⚠️  
- "Connection failed, retrying" 🔄
- "Audio context suspended" (Safari issue)
```

### Audio Quality Issues

#### High Latency (>2 seconds)
```bash
# Causes & Solutions:
1. Geographic distance → Use CDN/closer servers
2. Network congestion → Test at different times
3. Browser throttling → Close other tabs
4. Audio buffering → Clear browser cache
5. WebRTC fallback → Check if using WebSocket instead
```

#### Audio Dropouts/Stuttering
```bash
# Solutions:
1. Check sample rate (should be 24kHz)
2. Verify stable internet connection
3. Close bandwidth-heavy applications
4. Test with headphones (reduces echo cancellation load)
5. Monitor browser dev tools → Performance for memory leaks
```

#### Echo/Feedback Issues
```bash
# Solutions:
1. Use headphones (recommended)
2. Lower speaker volume
3. Check browser echo cancellation settings
4. Test different microphone (if external)
5. Move further from speakers
```

### Session & Memory Issues

#### Session Expires/Disconnects
```bash
# Normal behavior:
- OpenAI ephemeral keys expire after ~60 minutes
- System automatically refreshes

# Troubleshooting:
1. Check backend logs for session errors
2. Verify OpenAI API key validity
3. Monitor for rate limiting
4. Test session endpoint manually:
   curl -X POST https://your-backend.onrender.com/api/realtime/session
```

#### Memory Leaks/Performance Degradation
```bash
# Prevention:
1. Durmah automatically cleans up connections
2. Page refresh clears all memory
3. Monitor dev tools → Memory tab for growth

# If experiencing issues:
1. Refresh page every 2-3 hours for long sessions
2. Close other browser tabs
3. Check browser console for errors
```

### Network Diagnostics

#### Test Your Connection
```bash
# Basic connectivity:
curl -I https://your-render-service.onrender.com/api/healthz

# WebRTC capability test:
curl -X POST https://your-render-service.onrender.com/api/realtime/session

# CORS check:
curl -I -H "Origin: https://your-netlify-site.netlify.app" \
  https://your-render-service.onrender.com/api/healthz
```

#### Speed Requirements
```bash
# Minimum requirements:
- Upload: 64 kbps (for voice transmission)
- Download: 128 kbps (for audio response)
- Latency: <200ms to servers (for real-time feel)

# Test your speed:
# Use speedtest.net or similar
# High packet loss (>5%) will cause audio issues
```

### Emergency Fallback Modes

#### When Voice Completely Fails
```bash
# Durmah includes text-only fallback:
1. Widget will show "Voice unavailable, text mode active"
2. Type messages instead of speaking
3. AI responds with text (can use browser text-to-speech)
4. Full functionality maintained except real-time voice
```

#### Manual Fallback Activation
```bash
# If needed, force fallback mode:
# Add ?fallback=text to URL
# Or set VITE_FORCE_FALLBACK=true in environment
```

## 🧪 Testing

### Voice Quality Tests
```bash
# Test ultra-low latency (should be <1200ms)
1. Click voice button
2. Say "Hello Durmah" and measure time to first audio response
3. Verify response is <1200ms

# Test barge-in functionality (should be <300ms)
1. Ask a long question to get extended response
2. Interrupt mid-response with new question
3. Verify interruption happens <300ms
4. Verify new response addresses interruption
```

### Session Stability
```bash
# 10-minute continuous session test
1. Start voice session
2. Maintain conversation for 10+ minutes
3. Monitor browser console for errors
4. Verify no connection drops or memory leaks
```

### Cross-Browser Testing
- ✅ Chrome 120+ (Recommended)
- ✅ Edge 120+
- ✅ Safari 16+ (with user gesture requirements)
- ✅ Firefox 120+ (may require WebRTC polyfill)
- ⚠️ Mobile browsers (test with headphones)

## 🎓 Academic Integrity Features

### Built-in Guardrails
- **No Ghostwriting**: Durmah provides guidance, not completed work
- **OSCOLA Citations**: Helps with proper legal citation format
- **Integrity Reminders**: Every response includes academic integrity context
- **Educational Scaffolding**: Breaks down complex topics for learning

### Student-Aware Memory
- **Progress Tracking**: Remembers topics studied and areas of struggle
- **Wellbeing Monitoring**: Detects stress patterns and suggests breaks
- **Personalized Support**: Adapts responses based on individual learning style
- **Context Retention**: Maintains conversation history for coherent support

## 📱 Widget Integration

### Drop-in Component
```jsx
import { DurmahWidget } from './components/DurmahWidget';

function App() {
  return (
    <div>
      {/* Your existing application */}
      <DurmahWidget 
        apiBase="https://your-backend.onrender.com"
        supabaseUrl="https://your-project.supabase.co"
        supabaseAnonKey="your-anon-key"
      />
    </div>
  );
}
```

### Customization Options
- **Theme**: Light/dark mode support
- **Position**: Configurable floating button position
- **Size**: Compact/expanded widget modes
- **Voice**: Multiple voice options for TTS
- **Language**: Multi-language support (English default)

## 📊 Monitoring & Uptime Checks

### Health Check Endpoint
```bash
# Primary health check
GET https://your-render-service.onrender.com/api/healthz

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-08-23T22:26:30Z",
  "uptime": 3600,
  "memory": { "percentage": 5.8 },
  "connections": { "active": 2 },
  "version": "2.0.0"
}
```

### Basic Uptime Monitoring
```bash
# Quick system checks:
# 1. Backend availability
curl -f https://your-render-service.onrender.com/api/healthz

# 2. Voice session capability  
curl -X POST https://your-render-service.onrender.com/api/realtime/session

# 3. Frontend availability
curl -I https://your-netlify-site.netlify.app

# 4. CORS configuration
curl -I -H "Origin: https://your-netlify-site.netlify.app" \
  https://your-render-service.onrender.com/api/healthz
```

### External Monitoring Setup
```bash
# Free monitoring with UptimeRobot:
1. Go to uptimerobot.com (free account)
2. Add HTTP(s) monitor:
   - URL: https://your-render-service.onrender.com/api/healthz
   - Check interval: 5 minutes
   - Alert when down: 2 minutes
3. Add email/SMS notifications
```

### Performance Monitoring
```bash
# Response time check:
time curl -s https://your-render-service.onrender.com/api/healthz

# Expected: <200ms for health endpoint
# Alert if: >500ms consistently

# Voice performance (browser dev tools):
# 1. Open Network tab
# 2. Start voice session
# 3. Monitor WebRTC connection establishment
# 4. Measure first audio response time
```

### Render Platform Monitoring
```bash
# Render provides built-in monitoring:
- CPU usage alerts
- Memory usage alerts  
- Response time tracking
- Error rate monitoring
- Automatic restart on failures

# Access via Render dashboard:
# https://dashboard.render.com → Your Service → Metrics
```

### Student Success Metrics
- **Engagement Time**: Daily/weekly usage patterns
- **Topic Coverage**: Areas of focus and improvement
- **Wellbeing Indicators**: Stress levels and support needs
- **Academic Progress**: Learning trajectory and achievements

## 🤝 Contributing

Durmah is built for the Durham Law community. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Follow existing code style
4. Add tests for new features
5. Submit a pull request

## 📄 License

MIT License - Built with love for Durham Law students 💜

## 🆘 Support

For technical issues:
- Check the troubleshooting guide above
- Review browser console for error messages
- Test with different browsers/devices
- Verify environment variable configuration

For academic support:
- Durmah is designed to guide, not replace learning
- Always maintain academic integrity
- Use as a supplementary learning tool
- Seek human support for complex personal issues

---

**Built with ❤️ for Durham Law students by MiniMax Agent**
*"Every great lawyer started as a student who needed support. Durmah is here to be that support."*