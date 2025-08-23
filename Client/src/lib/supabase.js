// Client/src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url') {
  console.error('Missing or invalid VITE_SUPABASE_URL environment variable');
  console.error('Current value:', supabaseUrl);
  console.error('Please set this in your .env file or Netlify environment variables');
}

if (!supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key') {
  console.error('Missing or invalid VITE_SUPABASE_ANON_KEY environment variable');
  console.error('Current value:', supabaseAnonKey);
  console.error('Please set this in your .env file or Netlify environment variables');
}

// Ensure the client processes the OAuth redirect, saves the session,
// and keeps it refreshed & persisted.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // <-- critical for OAuth redirects
    flowType: 'pkce',           // recommended for browser apps
    debug: import.meta.env.DEV, // Enable debug logging in development
  },
  global: {
    headers: {
      'x-client-info': 'durmah-legal-buddy@1.0.0',
    },
  },
});

export default supabase;
