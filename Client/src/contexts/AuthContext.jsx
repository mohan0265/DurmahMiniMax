// Client/src/contexts/AuthContext.jsx - Real Supabase authentication for voice loop
import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key');

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get user display name from metadata or email
  const getUserDisplayName = (user) => {
    if (!user) return null;
    
    // Try user_metadata first (from sign up)
    if (user.user_metadata?.display_name) return user.user_metadata.display_name;
    if (user.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user.user_metadata?.name) return user.user_metadata.name;
    
    // Try app_metadata
    if (user.app_metadata?.display_name) return user.app_metadata.display_name;
    
    // Extract first name from email
    if (user.email) {
      const emailName = user.email.split('@')[0];
      // Convert dots/underscores to spaces and capitalize
      return emailName.replace(/[._]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    return 'Student';
  };

  // Check if user has voice access
  const hasVoiceAccess = (user) => {
    if (!user) return false;
    
    // Check app_metadata for voice_enabled flag
    if (user.app_metadata?.voice_enabled === true) return true;
    
    // Check user_metadata for voice_enabled flag
    if (user.user_metadata?.voice_enabled === true) return true;
    
    // For development/testing, allow all authenticated users
    if (import.meta.env.VITE_ALLOW_ANON_VOICE === 'true') return true;
    
    // Check if user has Durham email (example business logic)
    if (user.email?.endsWith('@durham.ac.uk')) return true;
    
    return false;
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setSession(session);
          setUser(session?.user || null);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (credentials) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw error;
      }

      return { user: data.user, session: data.session, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, session: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (credentials) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            display_name: credentials.name || credentials.displayName,
            full_name: credentials.fullName,
            university: credentials.university || 'Durham University',
            course: credentials.course,
            year: credentials.year,
            voice_enabled: credentials.email?.endsWith('@durham.ac.uk') || false
          }
        }
      });

      if (error) {
        throw error;
      }

      return { user: data.user, session: data.session, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, session: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      return { error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error };
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) {
        throw error;
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      return { user: null, error };
    } finally {
      setLoading(false);
    }
  };

  // Get user profile with extended information
  const getUserProfile = async () => {
    if (!user) return null;

    try {
      // You can extend this to fetch from a profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        console.error('Get profile error:', error);
      }

      return data;
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  };

  // Enhanced user object with computed properties
  const enhancedUser = user ? {
    ...user,
    displayName: getUserDisplayName(user),
    hasVoiceAccess: hasVoiceAccess(user),
    isStudent: user.email?.endsWith('@durham.ac.uk') || false,
    course: user.user_metadata?.course || 'Law',
    year: user.user_metadata?.year || 1,
    university: user.user_metadata?.university || 'Durham University'
  } : null;

  const value = {
    user: enhancedUser,
    session,
    loading,
    signIn,
    signOut,
    signUp,
    resetPassword,
    updateProfile,
    getUserProfile,
    
    // Computed properties
    isAuthenticated: !!user,
    hasVoiceAccess: enhancedUser?.hasVoiceAccess || false,
    displayName: enhancedUser?.displayName || null,
    
    // Supabase client for direct access
    supabase
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;