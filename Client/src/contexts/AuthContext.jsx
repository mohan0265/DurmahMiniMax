// Client/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribed = false;

    // 1) Process any OAuth params in the URL and fetch session
    const init = async () => {
      try {
        // Check if we're handling an OAuth callback
        const { searchParams } = new URL(window.location.href);
        const isOAuthCallback = searchParams.has('code') || searchParams.has('access_token') || searchParams.has('error');
        
        if (isOAuthCallback) {
          console.log('Handling OAuth callback...');
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!unsubscribed) {
          if (error) {
            console.error("getSession error:", error);
            // Don't block app initialization for session errors
          } else if (session) {
            console.log('Session found:', session.user.email);
          }
          
          setUser(session?.user ?? null);
          setReady(true);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (!unsubscribed) {
          setReady(true);
          setLoading(false);
        }
      }
    };
    
    init();

    // 2) Listen for sign-in/sign-out events (Google returns here as SIGNED_IN)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email || 'no user');
      
      if (!unsubscribed) {
        setUser(session?.user ?? null);
        setReady(true);
        setLoading(false);
        
        // Clean up URL after OAuth callback
        if (event === 'SIGNED_IN' && session && window.location.search) {
          const url = new URL(window.location.href);
          // Remove OAuth parameters from URL
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          url.searchParams.delete('access_token');
          url.searchParams.delete('refresh_token');
          url.searchParams.delete('token_type');
          url.searchParams.delete('expires_in');
          
          // Replace URL without refresh
          window.history.replaceState({}, document.title, url.toString());
        }
      }
    });

    return () => {
      unsubscribed = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Email/password (optional)
  const signUp = async (email, password, metadata = {}) => {
    try {
      return await supabase.auth.signUp({ email, password, options: { data: metadata } });
    } catch (error) {
      console.error('Sign up error:', error);
      return { error };
    }
  };

  const signIn = async (email, password) => {
    try {
      return await supabase.auth.signInWithPassword({ email, password });
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  // Google OAuth
  const signInWithGoogle = async () => {
    try {
      // Use a more specific redirect URL to avoid routing issues
      const redirectTo = `${window.location.origin}/dashboard`;
      console.log('Starting Google OAuth with redirect:', redirectTo);
      
      return await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { 
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });
    } catch (error) {
      console.error('Google sign in error:', error);
      return { error };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      ready, 
      loading, 
      signUp, 
      signIn, 
      signInWithGoogle, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
