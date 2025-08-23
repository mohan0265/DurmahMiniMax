const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with error handling for placeholder values
let supabase = null;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY;
  
  if (supabaseUrl && supabaseKey && 
      !supabaseUrl.includes('placeholder') && 
      !supabaseKey.includes('placeholder') &&
      !supabaseUrl.includes('test-project')) {
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    console.warn('Auth routes: Using placeholder Supabase credentials - auth features disabled');
  }
} catch (error) {
  console.warn('Auth routes: Supabase client initialization failed:', error.message);
}

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        error: 'service_unavailable',
        message: 'Authentication service is not configured. Please check server configuration.' 
      });
    }
    
    const { email, password, fullName, lawYear } = req.body;

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        law_year: lawYear
      }
    });

    if (authError) throw authError;

    // Create user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        law_year: lawYear,
        preferred_name: fullName.split(' ')[0]
      })
      .select()
      .single();

    if (profileError) throw profileError;

    res.json({
      success: true,
      message: 'Registration successful! Welcome to Durmah! 🦅',
      user: profile
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: data.user.id,
        email: data.user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Welcome back! 💜',
      token,
      user: data.user
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// Get session endpoint
router.get('/session', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user profile
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Session error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid session'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  res.json({
    success: true,
    message: 'See you soon! 👋'
  });
});

module.exports = router;