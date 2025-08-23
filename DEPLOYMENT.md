# 🚀 Durmah Legal Buddy - Deployment Guide

Complete deployment guide for Netlify (frontend) + Render.com (backend) + Supabase.

## 📋 Prerequisites

- GitHub repository with your code
- Supabase project with database schema applied
- OpenAI API key for AI responses
- Google OAuth configured in Supabase

## 🎯 Architecture Overview

- **Frontend**: React/Vite SPA deployed to Netlify
- **Backend**: Express API with WebSocket deployed to Render.com
- **Database/Auth**: Supabase (PostgreSQL + Google OAuth)
- **AI**: OpenAI GPT-4o-mini + Realtime API

## 🚀 Step 1: Deploy Backend to Render.com

### 1.1 Create Render Account
1. Go to [render.com](https://render.com) and sign up/login
2. Connect your GitHub account

### 1.2 Deploy Backend Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure service:
   - **Name**: `durmah-backend` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `Server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (or paid for production)

### 1.3 Set Environment Variables
In Render dashboard, add these environment variables:

```env
NODE_ENV=production
CLIENT_URL=https://<your-netlify-site>.netlify.app
OPENAI_API_KEY=sk-xxxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=service_role_xxx
JWT_SECRET=xxxx
SESSION_SECRET=xxxx
```

Optional variables:
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 1.4 Deploy and Test
1. Click "Create Web Service"
2. Wait for deployment to complete
3. Note your Render URL: `https://<your-app>.onrender.com`
4. Test health endpoint: `https://<your-app>.onrender.com/health`

## 🌐 Step 2: Deploy Frontend to Netlify

### 2.1 Create Netlify Account
1. Go to [netlify.com](https://netlify.com) and sign up/login
2. Connect your GitHub account

### 2.2 Deploy Frontend
1. Click "Add new site" → "Import an existing project"
2. Choose GitHub and select your repository
3. Configure build settings:
   - **Base directory**: `Client`
   - **Build command**: `npm run build`
   - **Publish directory**: `Client/dist`
   - **Node version**: `18` (in Environment variables)

### 2.3 Set Environment Variables
In Netlify dashboard → Site settings → Environment variables:

```env
VITE_API_URL=https://<render-app>.onrender.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=anon_xxx
```

### 2.4 Deploy and Note URL
1. Click "Deploy site"
2. Note your Netlify URL: `https://<random-name>.netlify.app`
3. Optionally set a custom domain

## 🗄️ Step 3: Configure Supabase

### 3.1 Update OAuth Settings
In Supabase dashboard → Authentication → URL Configuration:

**Site URL:**
```
https://<your-netlify-site>.netlify.app
```

**Redirect URLs:**
```
https://<your-netlify-site>.netlify.app/dashboard
http://localhost:5173/dashboard
```

### 3.2 Update CORS in Backend
Go back to Render and update the `CLIENT_URL` environment variable:
```env
CLIENT_URL=https://<your-netlify-site>.netlify.app
```

### 3.3 Apply Database Schema
1. Go to Supabase dashboard → SQL Editor
2. Run the SQL from `/database/schema.sql`
3. Verify tables and RLS policies are created

## ✅ Step 4: Verification

### 4.1 Backend Health Check
```bash
curl https://<render-app>.onrender.com/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### 4.2 WebSocket Connection
Test WebSocket endpoint:
```bash
# Should connect and respond to ping/pong
wss://<render-app>.onrender.com/voice
```

### 4.3 Frontend Functionality
1. Visit `https://<your-netlify-site>.netlify.app`
2. Click "Sign in with Google"
3. Should redirect to `/dashboard` after login
4. FloatingWidget should appear in bottom-right
5. Test text chat and voice features

## 🔧 Local Development

### Environment Setup
```bash
# Root directory
npm run install:all

# Server environment (create Server/.env)
cp Server/.env.example Server/.env
# Fill in your actual values

# Client environment (create Client/.env)
cp Client/.env.example Client/.env
# Set VITE_API_URL=http://localhost:3001
```

### Run Development Servers
```bash
# Terminal 1: Start backend
cd Server
PORT=3001 npm run dev

# Terminal 2: Start frontend
cd Client
npm run dev
```

Visit `http://localhost:5173` for development.

## 🚨 Troubleshooting

### Common Issues

**Render deployment failing:**
- Check build logs in Render dashboard
- Verify `npm start` script exists in Server/package.json
- Ensure all required environment variables are set

**Frontend not connecting to backend:**
- Verify `VITE_API_URL` points to correct Render URL
- Check CORS settings (CLIENT_URL in backend)
- Test health endpoint manually

**Authentication not working:**
- Verify OAuth redirect URLs in Supabase
- Check Supabase environment variables
- Ensure site URL matches actual deployment URL

**Voice features not working:**
- HTTPS required for production (Netlify provides this)
- Test in Chrome/Edge browsers
- Check browser console for WebSocket connection errors

### Render.com Specific

**Free tier limitations:**
- Apps sleep after 15 minutes of inactivity
- 750 hours/month limit
- Slower cold starts

**Upgrade considerations:**
- Paid plans for always-on services
- Better performance and reliability
- Custom domains and SSL

## 🔒 Security Checklist

- [ ] All `.env` files in `.gitignore`
- [ ] Rotate any API keys committed to git
- [ ] Use service keys, not personal keys
- [ ] Enable RLS policies in Supabase
- [ ] Set proper CORS origins
- [ ] Use strong JWT/session secrets
- [ ] Monitor logs for suspicious activity

## 🚀 Production Ready

Your Durmah Legal Buddy is now deployed and ready to serve Durham Law students with:

- ✅ Secure authentication via Google OAuth
- ✅ Real-time voice interaction
- ✅ AI-powered chat with GPT-4o-mini
- ✅ Responsive floating widget interface
- ✅ Scalable cloud infrastructure
- ✅ Environment-based configuration

The application provides 24/7 AI companionship for legal studies and wellbeing support!