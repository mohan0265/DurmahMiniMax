# Environment Setup Guide

This guide explains how to configure environment variables for the Durmah Legal Buddy application.

## Critical Environment Variables

The application **requires** these environment variables to function properly:

### Client Environment Variables

Create/update `Client/.env` file with:

```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anonymous_key
```

### Server Environment Variables

Create/update `.env` file in the root directory with:

```env
# Environment
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:3000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anonymous_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Security
JWT_SECRET=generate_32_character_random_string_here
SESSION_SECRET=another_32_character_random_string_here
```

## Getting Your Supabase Keys

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings > API
4. Copy the following:
   - **Project URL** → Use as `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → Use as `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
   - **service_role** key → Use as `SUPABASE_SERVICE_KEY` (server only)

## Netlify Deployment Environment Variables

When deploying to Netlify, set these environment variables in your Netlify dashboard:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anonymous_key
```

### How to Set Netlify Environment Variables

1. Go to your Netlify site dashboard
2. Navigate to Site Settings > Environment Variables
3. Click "Add a variable"
4. Add each variable with its key and value

## OAuth Configuration

### Google OAuth Setup

1. In your Supabase dashboard, go to Authentication > Providers
2. Enable Google provider
3. Add your site URL to "Site URL" (e.g., `https://your-app.netlify.app`)
4. Add redirect URLs:
   - `https://your-app.netlify.app/dashboard` (production)
   - `http://localhost:3000/dashboard` (development)

### Redirect URL Configuration

The application is configured to redirect users to `/dashboard` after successful Google OAuth authentication. This is set in:
- `Client/src/contexts/AuthContext.jsx` in the `signInWithGoogle` function

## Troubleshooting

### "Missing environment variables" errors

If you see console errors about missing environment variables:

1. Ensure your `.env` files are properly configured
2. Restart your development server after changing environment variables
3. Check that your variable names start with `VITE_` for client-side variables
4. Verify your Supabase keys are correct and your project is active

### OAuth redirect loops

If users get stuck in redirect loops:

1. Verify your redirect URLs are correctly configured in Supabase
2. Check that your `VITE_SUPABASE_URL` environment variable is set
3. Ensure your site URL in Supabase matches your deployment URL

### Database connection issues

If you have database connection problems:

1. Verify your `SUPABASE_SERVICE_KEY` is correct
2. Check that your Supabase project is active and not paused
3. Ensure your database schema has been applied (run `database/schema.sql`)

## Development vs Production

### Development URLs
- Client: `http://localhost:3000`
- Server: `http://localhost:3001`

### Production URLs
- Client: Your Netlify app URL (e.g., `https://durmah-legal-buddy.netlify.app`)
- Server: Your backend deployment URL (e.g., Fly.io app)

Make sure to update your environment variables and Supabase configuration when switching between development and production environments.