# 🚀 Durmah Voice Loop - Production Deployment Guide

This guide will walk you through deploying the Durmah Voice Loop system to production using **Render.com** for the backend and **Netlify** for the frontend.

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ **OpenAI API Key** with Realtime API access
- ✅ **Supabase Project** set up with authentication
- ✅ **GitHub Repository** with your code
- ✅ **Render.com Account** (free tier available)
- ✅ **Netlify Account** (free tier available)
- ✅ **Domain name** (optional, both services provide subdomains)

## 🗄️ Step 1: Set Up Supabase

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (2-3 minutes)
3. Go to **Settings > API** and copy:
   - `Project URL`
   - `anon public key`

### 1.2 Configure Authentication
```sql
-- Optional: Create a profiles table for extended user data
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  university text DEFAULT 'Durham University',
  course text DEFAULT 'Law',
  year integer DEFAULT 1,
  voice_enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own data
CREATE POLICY "Users can access their own profile" ON profiles
  FOR ALL USING (auth.uid() = id);
```

### 1.3 Enable Email Authentication
1. Go to **Authentication > Settings**
2. Configure your email templates
3. Set up email provider (SMTP) or use Supabase's default

## 🖥️ Step 2: Deploy Backend to Render

### 2.1 Connect GitHub Repository
1. Go to [render.com](https://render.com) and sign up/login
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Select the root directory (contains the `Server/` folder)

### 2.2 Configure Build Settings
```bash
# Build Command
cd Server && npm install

# Start Command  
cd Server && npm start

# Environment
Node.js
```

### 2.3 Set Environment Variables
In your Render service dashboard, add these environment variables:

**Required Variables:**
```bash
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=sk-your-actual-openai-key
JWT_SECRET=your-super-secret-jwt-key-make-it-long-and-random
```

**Optional but Recommended:**
```bash
ELEVENLABS_API_KEY=your-elevenlabs-key-if-you-have-one
REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01
OPENAI_VOICE=nova
MAX_SESSION_MINUTES=30
LOG_LEVEL=info
LOG_TO_FILE=true
RATE_LIMIT_MAX=100
DEBUG_VOICE=false
```

**Security Variables:**
```bash
# This will be your Netlify URL once deployed
ALLOWED_ORIGINS=https://your-netlify-app.netlify.app
```

### 2.4 Deploy
1. Click **Create Web Service**
2. Wait for deployment (5-10 minutes)
3. Test your API: `https://your-app.onrender.com/health`

## 🌐 Step 3: Deploy Frontend to Netlify

### 3.1 Connect GitHub Repository
1. Go to [netlify.com](https://netlify.com) and login
2. Click **Add new site** → **Import from Git**
3. Choose your GitHub repository
4. Configure build settings:

```bash
# Base directory
Client/

# Build command
npm run build

# Publish directory  
Client/dist/
```

### 3.2 Set Environment Variables
In **Site Settings > Environment Variables**, add:

**Required Variables:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SESSION_ENDPOINT=https://your-render-app.onrender.com/api/realtime/session
VITE_API_URL=https://your-render-app.onrender.com
```

**Configuration Variables:**
```bash
VITE_ALLOW_ANON_VOICE=false
VITE_REQUIRE_LOGIN=true
VITE_ENABLE_TEXT_FALLBACK=true
VITE_SHOW_BRANDING=true
```

### 3.3 Deploy
1. Click **Deploy site**
2. Wait for build and deployment
3. Test your app: `https://your-app.netlify.app`

## 🔄 Step 4: Update CORS Settings

### 4.1 Update Render Environment
Go back to your Render service and update:
```bash
ALLOWED_ORIGINS=https://your-netlify-app.netlify.app,https://your-custom-domain.com
```

### 4.2 Redeploy Backend
Your Render service should auto-redeploy after environment changes.

## 🧪 Step 5: Test End-to-End

### 5.1 Test Authentication
1. Visit your Netlify URL
2. Sign up with a new account
3. Verify email if required
4. Confirm user appears in Supabase Auth dashboard

### 5.2 Test Voice Functionality
1. Sign in to your deployed app
2. Click the Durmah widget
3. Allow microphone access
4. Test voice interaction
5. Check browser console for any errors

### 5.3 Monitor Backend
1. Check Render logs: `https://dashboard.render.com/web/your-service-id`
2. Monitor health endpoint: `https://your-app.onrender.com/health`
3. Test API endpoints manually if needed

## 🚨 Step 6: Production Hardening

### 6.1 Security Checklist
- [ ] Strong JWT secret (32+ random characters)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Environment variables secured

### 6.2 Supabase Security
```sql
-- Enable RLS on any custom tables
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Create appropriate policies
CREATE POLICY "Users can only access their own data" 
ON your_table FOR ALL USING (auth.uid() = user_id);
```

### 6.3 Monitoring Setup
1. **Render**: Enable log streaming and alerts
2. **Netlify**: Set up deploy notifications
3. **Supabase**: Monitor usage and set up alerts
4. **OpenAI**: Monitor API usage and set billing alerts

## 🔧 Step 7: Custom Domains (Optional)

### 7.1 Backend Domain (Render)
1. Go to **Settings** in your Render service
2. Add custom domain
3. Update DNS CNAME record
4. Wait for SSL certificate

### 7.2 Frontend Domain (Netlify)
1. Go to **Domain Settings**
2. Add custom domain
3. Update DNS settings
4. Enable HTTPS

## 📊 Step 8: Environment-Specific Configuration

### 8.1 Staging Environment
Create staging versions with:
```bash
# Staging Backend
ALLOWED_ORIGINS=https://staging-app.netlify.app
LOG_LEVEL=debug

# Staging Frontend  
VITE_SESSION_ENDPOINT=https://staging-api.onrender.com/api/realtime/session
```

### 8.2 Production Monitoring
```bash
# Production Backend
LOG_LEVEL=info
LOG_TO_FILE=true
RATE_LIMIT_MAX=50  # Stricter limits
DEBUG_VOICE=false
```

## 🚨 Troubleshooting

### Common Issues

**1. CORS Errors**
- Check `ALLOWED_ORIGINS` includes your Netlify URL
- Verify no trailing slashes in URLs
- Redeploy backend after CORS changes

**2. WebSocket Connection Failures**
- Ensure WSS (not WS) for production
- Check Render service allows WebSocket connections
- Verify no proxy/CDN blocking WebSockets

**3. Authentication Issues**
- Confirm Supabase URL and keys are correct
- Check email authentication is enabled
- Verify redirect URLs in Supabase settings

**4. Voice API Errors**
- Validate OpenAI API key has Realtime access
- Check API usage/billing limits
- Monitor backend logs for detailed errors

**5. Build Failures**
- Check Node.js version compatibility (use v18)
- Verify all dependencies are in package.json
- Check build commands match folder structure

## 📈 Scaling Considerations

### Performance Optimization
- **Render**: Upgrade to Standard plan for better performance
- **Netlify**: Enable Edge Functions for global distribution
- **Supabase**: Monitor database performance
- **CDN**: Consider Cloudflare for static assets

### Cost Optimization
- **Render**: Free tier has sleep mode; Standard plan for 24/7 uptime
- **OpenAI**: Monitor usage to avoid unexpected costs
- **Supabase**: Free tier generous for small apps

---

## 🎯 Quick Deployment Checklist

- [ ] Supabase project created with auth configured
- [ ] OpenAI API key with Realtime API access
- [ ] Render backend deployed with all env vars
- [ ] Netlify frontend deployed with Supabase config
- [ ] CORS updated with frontend URL
- [ ] End-to-end voice flow tested
- [ ] Production monitoring enabled
- [ ] SSL certificates active
- [ ] Domain names configured (if using custom domains)

**🎉 Your Durmah Voice Loop is now live in production!**

For support, check the main README.md or create an issue in the repository.