// Client/src/contexts/VoiceModeContext.jsx - App-wide voice/text mode management
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const VoiceModeContext = createContext();

export const useVoiceMode = () => {
  const context = useContext(VoiceModeContext);
  if (!context) {
    throw new Error('useVoiceMode must be used within a VoiceModeProvider');
  }
  return context;
};

export const VoiceModeProvider = ({ children }) => {
  const { hasVoiceAccess, isAuthenticated } = useAuth();
  
  // Core mode state
  const [mode, setMode] = useState('text'); // 'voice' | 'text'
  const [isMicAvailable, setIsMicAvailable] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState('unknown'); // 'granted' | 'denied' | 'prompt' | 'unknown'
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [voicePreference, setVoicePreference] = useState('auto'); // 'auto' | 'always-voice' | 'always-text'
  
  // Conversation continuity
  const [conversationHistory, setConversationHistory] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  
  // Voice state management
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Error and retry state
  const [micError, setMicError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastMicAttempt, setLastMicAttempt] = useState(null);

  // Initialize conversation ID
  useEffect(() => {
    if (!conversationId) {
      setConversationId(`conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }
  }, [conversationId]);

  // Check microphone permissions and availability
  const checkMicPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsMicAvailable(false);
        setMicPermissionStatus('denied');
        return false;
      }

      // Check permission API if available
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          setMicPermissionStatus(permission.state);
          
          permission.onchange = () => {
            setMicPermissionStatus(permission.state);
            if (permission.state === 'denied' && mode === 'voice') {
              handleMicAccessLost();
            }
          };
        } catch (e) {
          console.warn('Permissions API not fully supported:', e);
        }
      }

      // Test actual microphone access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        // Immediately close the test stream
        stream.getTracks().forEach(track => track.stop());
        
        setIsMicAvailable(true);
        setMicPermissionStatus('granted');
        setMicError(null);
        return true;
      } catch (error) {
        console.warn('Microphone test failed:', error);
        setIsMicAvailable(false);
        setMicError(error.message);
        
        if (error.name === 'NotAllowedError') {
          setMicPermissionStatus('denied');
        } else if (error.name === 'NotFoundError') {
          setMicPermissionStatus('denied');
          setMicError('No microphone found');
        }
        
        return false;
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      setIsMicAvailable(false);
      setMicError(error.message);
      return false;
    }
  }, [mode]);

  // Auto-launch mic logic with retry
  const attemptVoiceModeActivation = useCallback(async (forceRetry = false) => {
    if (!hasVoiceAccess) {
      return false;
    }

    const now = Date.now();
    
    // Rate limit attempts (max 1 per 2 seconds)
    if (!forceRetry && lastMicAttempt && (now - lastMicAttempt) < 2000) {
      return false;
    }
    
    setLastMicAttempt(now);
    
    try {
      const micAvailable = await checkMicPermissions();
      
      if (micAvailable) {
        setMode('voice');
        setIsVoiceModeActive(true);
        setRetryCount(0);
        toast.success('🎤 Voice mode activated!');
        return true;
      } else {
        // Handle different failure scenarios
        if (micPermissionStatus === 'denied') {
          toast.error('Microphone access denied. Please enable in browser settings.');
        } else if (retryCount < 2) {
          setRetryCount(prev => prev + 1);
          toast('🎤 Requesting microphone access...', { duration: 2000 });
          
          // Auto-retry after a short delay
          setTimeout(() => attemptVoiceModeActivation(true), 3000);
        } else {
          toast.error('Unable to access microphone. Switching to text mode.');
          fallbackToTextMode();
        }
        
        return false;
      }
    } catch (error) {
      console.error('Voice activation failed:', error);
      setMicError(error.message);
      fallbackToTextMode();
      return false;
    }
  }, [hasVoiceAccess, micPermissionStatus, retryCount, lastMicAttempt, checkMicPermissions]);

  // Graceful fallback to text mode
  const fallbackToTextMode = useCallback(() => {
    setMode('text');
    setIsVoiceModeActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsThinking(false);
    
    if (micError && !micError.includes('denied')) {
      toast('💬 Switched to text mode', { 
        icon: '📝',
        duration: 3000 
      });
    }
  }, [micError]);

  // Handle loss of microphone access
  const handleMicAccessLost = useCallback(() => {
    if (mode === 'voice') {
      fallbackToTextMode();
      toast.error('Microphone access lost. Switched to text mode.');
    }
  }, [mode, fallbackToTextMode]);

  // Smart mode switching
  const switchToVoiceMode = useCallback(async () => {
    if (!hasVoiceAccess) {
      toast.error('Voice access not enabled for your account');
      return false;
    }

    const success = await attemptVoiceModeActivation();
    return success;
  }, [hasVoiceAccess, attemptVoiceModeActivation]);

  const switchToTextMode = useCallback(() => {
    setMode('text');
    setIsVoiceModeActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsThinking(false);
    
    toast('📝 Switched to text mode', { 
      icon: '💬',
      duration: 2000 
    });
  }, []);

  // Toggle between modes
  const toggleMode = useCallback(async () => {
    if (mode === 'text') {
      return await switchToVoiceMode();
    } else {
      switchToTextMode();
      return true;
    }
  }, [mode, switchToVoiceMode, switchToTextMode]);

  // Add message to conversation history
  const addMessage = useCallback((message) => {
    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      conversationId,
      mode: mode,
      ...message
    };
    
    setConversationHistory(prev => [...prev, newMessage]);
    return newMessage;
  }, [conversationId, mode]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    setConversationId(`conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // Get conversation context for AI
  const getConversationContext = useCallback(() => {
    return {
      conversationId,
      mode,
      messageCount: conversationHistory.length,
      recentMessages: conversationHistory.slice(-10), // Last 10 messages
      userPreferences: {
        voicePreference,
        hasVoiceAccess,
        isAuthenticated
      }
    };
  }, [conversationId, mode, conversationHistory, voicePreference, hasVoiceAccess, isAuthenticated]);

  // Response formatting based on mode
  const formatResponseForMode = useCallback((response, targetMode = mode) => {
    if (targetMode === 'voice') {
      // Voice mode: shorter, more conversational
      return formatForVoice(response);
    } else {
      // Text mode: can be longer, more detailed
      return formatForText(response);
    }
  }, [mode]);

  // Initialize mic check on mount
  useEffect(() => {
    checkMicPermissions();
  }, [checkMicPermissions]);

  // Auto-launch voice mode based on user preference
  useEffect(() => {
    if (hasVoiceAccess && voicePreference === 'always-voice' && mode === 'text') {
      attemptVoiceModeActivation();
    }
  }, [hasVoiceAccess, voicePreference, mode, attemptVoiceModeActivation]);

  const value = {
    // Core mode state
    mode,
    isVoiceModeActive,
    isMicAvailable,
    micPermissionStatus,
    voicePreference,
    setVoicePreference,
    
    // Voice state
    isListening,
    isSpeaking, 
    isThinking,
    audioLevel,
    setIsListening,
    setIsSpeaking,
    setIsThinking,
    setAudioLevel,
    
    // Error state
    micError,
    retryCount,
    
    // Conversation state
    conversationHistory,
    conversationId,
    addMessage,
    clearConversation,
    getConversationContext,
    
    // Mode switching
    switchToVoiceMode,
    switchToTextMode,
    toggleMode,
    attemptVoiceModeActivation,
    fallbackToTextMode,
    
    // Utilities
    checkMicPermissions,
    formatResponseForMode,
    
    // Computed properties
    canUseVoice: hasVoiceAccess && isMicAvailable,
    isInVoiceMode: mode === 'voice' && isVoiceModeActive,
    shouldShowVoiceControls: hasVoiceAccess,
  };

  return (
    <VoiceModeContext.Provider value={value}>
      {children}
    </VoiceModeContext.Provider>
  );
};

// Helper functions for response formatting
function formatForVoice(response) {
  if (!response || typeof response !== 'string') return response;
  
  // Split into sentences and take first 1-2 for voice
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length <= 2) {
    return response;
  }
  
  // Take first 2 sentences for voice, but ensure it's conversational
  let voiceResponse = sentences.slice(0, 2).join('. ').trim();
  
  // Add natural endings for voice
  if (!voiceResponse.match(/[.!?]$/)) {
    voiceResponse += '.';
  }
  
  // If truncated, add a natural continuation prompt
  if (sentences.length > 2) {
    voiceResponse += ' Would you like me to explain more about this?';
  }
  
  return voiceResponse;
}

function formatForText(response) {
  // Text mode can handle full response as-is
  return response;
}

export default VoiceModeContext;