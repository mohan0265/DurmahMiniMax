# 🚀 Durmah Deployment Guide

*Complete step-by-step guide for deploying Durmah to production*

## Overview

**Architecture:**
- **Backend**: Render (Node.js/Express with WebRTC)
- **Frontend**: Netlify (React/Vite Widget)
- **Database**: Supabase (PostgreSQL with RLS)
- **Voice**: OpenAI Realtime API + ElevenLabs TTS

**Deployment Flow:**
```
GitHub Repo → Render (Backend) ← WebRTC ← Netlify (Frontend)
      ↓                              ↑
  Supabase DB ←────── API calls ──────┘
```

## Prerequisites

### Required Accounts
- [x] GitHub account with repo access
- [x] Render account (free tier available)
- [x] Netlify account (free tier available)
- [x] Supabase project (free tier available)
- [x] OpenAI API account with Realtime API access
- [x] ElevenLabs account (optional, for premium TTS)

### Required API Keys
```bash
# OpenAI (Required)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase (Required)
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ElevenLabs (Optional but recommended)
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create new project
2. Choose a region close to your users (US East for NA, EU West for Europe)
3. Set a strong database password
4. Wait for project initialization (2-3 minutes)

### 1.2 Import Database Schema
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `/database/schema.sql`
4. Paste and run the SQL script
5. Verify all tables are created:
   - users, conversations, messages
   - study_progress, wellbeing_logs, achievements
   - All RLS policies enabled

### 1.3 Get API Keys
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **Anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **Service role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Step 2: Backend Deployment (Render)

### 2.1 Create Render Web Service
1. Go to [render.com](https://render.com) and sign up
2. Click **New** → **Web Service**
3. Connect your GitHub repo: `https://github.com/mohan0265/DurmahLegalBuddyGPT`
4. Configure service settings:
   - **Name**: `durmah-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty
   - **Runtime**: Node.js
   - **Build Command**: `cd Server && npm install`
   - **Start Command**: `cd Server && npm start`

### 2.2 Configure Environment Variables
Go to **Environment** tab and add these variables:

```bash
# === Core Configuration ===
NODE_ENV=production
LOG_LEVEL=info
HEALTHCHECK_PATH=/api/healthz

# === OpenAI Configuration ===
OPENAI_API_KEY=sk-your-openai-key-here
REALTIME_API_BASE=https://api.openai.com
REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17

# === ElevenLabs Configuration ===
ELEVENLABS_API_KEY=your-elevenlabs-key-here
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL

# === Supabase Configuration ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# === CORS Configuration ===
# Add your Netlify URL once deployed
ALLOWED_ORIGINS=http://localhost:5173,https://localhost:5173

# === Voice Defaults ===
DEFAULT_VOICE=alloy
DEFAULT_SAMPLE_RATE=24000

# === Security ===
JWT_SECRET=your-32-character-random-string-here
SESSION_SECRET=another-32-character-random-string-here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2.3 Deploy Backend
1. Click **Create Web Service**
2. Wait for deployment (5-10 minutes)
3. Note your backend URL: `https://your-service.onrender.com`
4. Test health check: `https://your-service.onrender.com/api/healthz`

### 2.4 Verify Backend Deployment
```bash
# Test health endpoint
curl https://your-service.onrender.com/api/healthz
# Should return: {"status":"ok","timestamp":"...","uptime":...}

# Test CORS (replace with your actual URL)
curl -I https://your-service.onrender.com/api/realtime/session
# Should return CORS headers
```

## Step 3: Frontend Deployment (Netlify)

### 3.1 Create Netlify Site
1. Go to [netlify.com](https://netlify.com) and sign up
2. Click **Add new site** → **Import an existing project**
3. Connect to GitHub and select your repo
4. Configure build settings:
   - **Base directory**: Leave empty
   - **Build command**: `cd Client && npm install && npm run build`
   - **Publish directory**: `Client/dist`
   - **Production branch**: `main`

### 3.2 Configure Environment Variables
Go to **Site settings** → **Environment variables** and add:

```bash
# === Backend Connection ===
VITE_API_BASE=https://your-render-service.onrender.com
VITE_SESSION_ENDPOINT=/api/realtime/session

# === OpenAI Configuration ===
VITE_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17

# === Supabase Configuration ===
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# === TTS Configuration ===
VITE_TTS_PROVIDER=elevenlabs

# === App Configuration ===
VITE_APP_NAME=Durmah
VITE_DEBUG_VOICE=false
VITE_MAX_SESSION_MINUTES=10
VITE_DEFAULT_VOICE=alloy
VITE_SAMPLE_RATE=24000
VITE_ENABLE_CAPTIONS=true

# === Feature Flags ===
VITE_ENABLE_WIDGET_MODE=true
VITE_ENABLE_FULLSCREEN_MODE=true
VITE_ENABLE_MOBILE_OPTIMIZATIONS=true

# === Accessibility ===
VITE_KEYBOARD_NAV=true
VITE_HIGH_CONTRAST=false
VITE_LARGE_TEXT=false
```

### 3.3 Update CORS Origins
1. Go back to your Render dashboard
2. Update the `ALLOWED_ORIGINS` environment variable:
   ```
   ALLOWED_ORIGINS=https://your-netlify-site.netlify.app,http://localhost:5173
   ```
3. Redeploy the backend service

### 3.4 Deploy Frontend
1. Click **Deploy site** in Netlify
2. Wait for build completion (3-5 minutes)
3. Note your frontend URL: `https://your-site.netlify.app`
4. Test the deployment by visiting the URL

### 3.5 Configure Custom Domain (Optional)
1. Go to **Domain settings** in Netlify
2. Add custom domain: `durmah.yourlaw.school`
3. Follow DNS configuration instructions
4. Update `ALLOWED_ORIGINS` in Render with new domain

## Step 4: Final Configuration

### 4.1 Test Full Integration
1. Visit your Netlify URL
2. Click the floating voice button
3. Grant microphone permission
4. Test voice interaction:
   - "Hello Durmah, can you help me with contract law?"
   - Verify <1200ms first response
   - Test barge-in by interrupting a response

### 4.2 Monitor Deployment
```bash
# Check backend logs in Render dashboard
# Check frontend build logs in Netlify dashboard
# Monitor browser console for any errors
```

### 4.3 Performance Optimization

#### Render Backend Optimization
1. **Upgrade Plan**: For production, use Standard plan or higher
2. **Region Selection**: Choose region closest to users
3. **Health Checks**: Ensure `/api/healthz` responds quickly
4. **Environment**: Set `NODE_ENV=production`

#### Netlify Frontend Optimization
1. **Build Optimization**: Enable asset optimization in site settings
2. **CDN**: Netlify's global CDN is automatic
3. **Caching**: Configure cache headers in `netlify.toml`
4. **Performance**: Monitor Lighthouse scores

## Step 5: Testing & Validation

### 5.1 Voice Performance Tests
```bash
# Test ultra-low latency
1. Click voice button
2. Say "Hello Durmah" immediately
3. Measure time to first audio response
4. Target: <1200ms

# Test barge-in functionality
1. Ask a complex question
2. Interrupt mid-response with "Actually..."
3. Verify interruption happens quickly
4. Target: <300ms interruption time
```

### 5.2 Cross-Browser Testing
- **Chrome 120+**: ✅ Full functionality
- **Edge 120+**: ✅ Full functionality
- **Safari 16+**: ⚠️ Requires user gesture for audio
- **Firefox 120+**: ⚠️ May need WebRTC polyfills
- **Mobile**: ✅ Works with headphones recommended

### 5.3 Session Stability Test
```bash
# 10-minute continuous session
1. Start voice session
2. Maintain conversation for 10+ minutes
3. Monitor browser console for errors
4. Verify no memory leaks or connection drops
```

### 5.4 Integration Test
```bash
# Supabase connection
1. Have a conversation with Durmah
2. Check Supabase dashboard for saved messages
3. Verify user profile updates

# Memory persistence
1. End session and start new one
2. Reference previous conversation
3. Verify Durmah remembers context
```

## Step 6: Production Checklist

### Security Checklist
- [x] All API keys stored in environment variables (not code)
- [x] CORS properly configured with specific origins
- [x] Supabase RLS policies enabled and tested
- [x] Rate limiting configured on backend
- [x] HTTPS enforced on all endpoints
- [x] No sensitive data in client-side code

### Performance Checklist
- [x] Backend health check responding <200ms
- [x] Frontend loading <3s on 3G connection
- [x] Voice response <1200ms first audio
- [x] Barge-in working <300ms
- [x] 10+ minute sessions stable
- [x] Memory usage stable over time

### Accessibility Checklist
- [x] Keyboard navigation working
- [x] ARIA labels present
- [x] Screen reader compatibility
- [x] High contrast mode available
- [x] Large text options working
- [x] Voice activation alternatives

### Monitoring Setup
- [x] Render service monitoring enabled
- [x] Netlify build notifications configured
- [x] Supabase project alerts set up
- [x] OpenAI usage monitoring active
- [x] Browser error reporting configured

## Troubleshooting

### Common Issues

#### "Microphone permission denied"
```bash
# Solutions:
1. Ensure HTTPS (required for mic access)
2. Check browser permissions settings
3. Try different browser
4. Clear browser cache and cookies
```

#### "WebRTC connection failed"
```bash
# Solutions:
1. Check TURN server configuration
2. Test on different network (corporate firewalls)
3. Verify CORS settings
4. Check browser WebRTC support
5. Use WebSocket fallback
```

#### "Session expired" errors
```bash
# Solutions:
1. Check OpenAI API key validity
2. Verify ephemeral key generation
3. Check backend logs for errors
4. Test session endpoint manually
```

#### High latency issues
```bash
# Solutions:
1. Check geographic distance to servers
2. Test different voice models
3. Verify network connection quality
4. Monitor backend response times
```

### Debug Mode
Enable debug logging:
```bash
# In Netlify environment variables:
VITE_DEBUG_VOICE=true

# Check browser console for detailed logs
# Check Render logs for backend debugging
```

## Maintenance

### Regular Tasks
- Monitor API usage and costs (OpenAI, ElevenLabs)
- Check Render/Netlify build status
- Review Supabase database growth
- Update dependencies monthly
- Monitor performance metrics
- Review user feedback and logs

### Scaling Considerations
- Render: Upgrade to Standard/Pro for higher traffic
- Netlify: Enterprise plan for advanced features
- Supabase: Pro plan for higher database limits
- OpenAI: Monitor rate limits and upgrade as needed

---

**Deployment Complete! 🎉**

Your Durmah voice-mode tutor widget is now live and ready to support Durham Law students with ChatGPT-grade voice interaction.

**Next Steps:**
1. Share with initial users for feedback
2. Monitor performance and usage
3. Iterate based on student needs
4. Scale infrastructure as usage grows

*Built with ❤️ for Durham Law students*