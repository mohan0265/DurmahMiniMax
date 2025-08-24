// Client/src/hooks/useMode.ts - Custom hook for mode management and transitions
import { useCallback, useEffect, useState } from 'react';
import { useVoiceMode } from '../contexts/VoiceModeContext';
import { useAuth } from '../contexts/AuthContext';

export interface ModeTransitionOptions {
  autoRetry?: boolean;
  showToasts?: boolean;
  fallbackDelay?: number;
}

export const useMode = () => {
  const voiceMode = useVoiceMode();
  const { hasVoiceAccess } = useAuth();
  
  const [transitionInProgress, setTransitionInProgress] = useState(false);
  const [lastTransitionError, setLastTransitionError] = useState<string | null>(null);

  // Enhanced mode switching with better error handling
  const safeSwitch = useCallback(async (
    targetMode: 'voice' | 'text', 
    options: ModeTransitionOptions = {}
  ) => {
    const { autoRetry = true, showToasts = true, fallbackDelay = 3000 } = options;
    
    if (transitionInProgress) {
      return false;
    }
    
    setTransitionInProgress(true);
    setLastTransitionError(null);
    
    try {
      if (targetMode === 'voice') {
        if (!hasVoiceAccess) {
          throw new Error('Voice access not enabled for your account');
        }
        
        const success = await voiceMode.switchToVoiceMode();
        
        if (!success && autoRetry) {
          // Auto-retry once after a delay
          setTimeout(async () => {
            try {
              await voiceMode.attemptVoiceModeActivation(true);
            } catch (retryError) {
              console.warn('Voice mode retry failed:', retryError);
            }
          }, fallbackDelay);
        }
        
        return success;
      } else {
        voiceMode.switchToTextMode();
        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLastTransitionError(errorMessage);
      console.error('Mode switch failed:', error);
      
      // Auto-fallback to text mode if voice fails
      if (targetMode === 'voice') {
        voiceMode.fallbackToTextMode();
      }
      
      return false;
    } finally {
      setTransitionInProgress(false);
    }
  }, [voiceMode, hasVoiceAccess, transitionInProgress]);

  // Smart toggle that considers current state
  const intelligentToggle = useCallback(async () => {
    if (voiceMode.mode === 'text') {
      // Switching to voice - check if conditions are met
      if (!hasVoiceAccess) {
        return { success: false, reason: 'no_voice_access' };
      }
      
      if (!voiceMode.isMicAvailable && voiceMode.micPermissionStatus === 'denied') {
        return { success: false, reason: 'mic_denied' };
      }
      
      const success = await safeSwitch('voice');
      return { success, reason: success ? 'switched_to_voice' : 'voice_failed' };
    } else {
      // Switching to text - always succeeds
      const success = await safeSwitch('text');
      return { success, reason: 'switched_to_text' };
    }
  }, [voiceMode.mode, hasVoiceAccess, voiceMode.isMicAvailable, voiceMode.micPermissionStatus, safeSwitch]);

  // Get current mode status with context
  const getModeStatus = useCallback(() => {
    return {
      current: voiceMode.mode,
      isActive: voiceMode.isVoiceModeActive,
      canSwitchToVoice: hasVoiceAccess && (voiceMode.isMicAvailable || voiceMode.micPermissionStatus !== 'denied'),
      canSwitchToText: true,
      micAvailable: voiceMode.isMicAvailable,
      micPermission: voiceMode.micPermissionStatus,
      transitionInProgress,
      lastError: lastTransitionError,
      voiceState: {
        isListening: voiceMode.isListening,
        isSpeaking: voiceMode.isSpeaking,
        isThinking: voiceMode.isThinking,
        audioLevel: voiceMode.audioLevel
      }
    };
  }, [
    voiceMode.mode,
    voiceMode.isVoiceModeActive,
    hasVoiceAccess,
    voiceMode.isMicAvailable,
    voiceMode.micPermissionStatus,
    transitionInProgress,
    lastTransitionError,
    voiceMode.isListening,
    voiceMode.isSpeaking,
    voiceMode.isThinking,
    voiceMode.audioLevel
  ]);

  // Auto-recovery logic
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && voiceMode.mode === 'voice' && !voiceMode.isVoiceModeActive) {
        // Page became visible and we should be in voice mode - try to recover
        setTimeout(() => {
          voiceMode.attemptVoiceModeActivation(true);
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [voiceMode.mode, voiceMode.isVoiceModeActive, voiceMode.attemptVoiceModeActivation]);

  return {
    // Current state
    mode: voiceMode.mode,
    isVoiceMode: voiceMode.mode === 'voice',
    isTextMode: voiceMode.mode === 'text',
    isActive: voiceMode.isVoiceModeActive,
    
    // Transition controls
    switchToVoice: () => safeSwitch('voice'),
    switchToText: () => safeSwitch('text'),
    toggle: intelligentToggle,
    
    // Status and diagnostics
    getStatus: getModeStatus,
    transitionInProgress,
    lastError: lastTransitionError,
    
    // Voice-specific state (proxied from context)
    isListening: voiceMode.isListening,
    isSpeaking: voiceMode.isSpeaking,
    isThinking: voiceMode.isThinking,
    audioLevel: voiceMode.audioLevel,
    
    // Mic diagnostics
    micAvailable: voiceMode.isMicAvailable,
    micPermission: voiceMode.micPermissionStatus,
    micError: voiceMode.micError,
    
    // Convenience flags
    canUseVoice: voiceMode.canUseVoice,
    shouldShowVoiceControls: voiceMode.shouldShowVoiceControls,
    isInVoiceMode: voiceMode.isInVoiceMode
  };
};

// Hook specifically for response formatting
export const useResponseFormatter = () => {
  const { formatResponseForMode, mode } = useVoiceMode();
  
  const formatResponse = useCallback((response: string, targetMode?: 'voice' | 'text') => {
    return formatResponseForMode(response, targetMode);
  }, [formatResponseForMode]);
  
  const formatForCurrentMode = useCallback((response: string) => {
    return formatResponseForMode(response, mode);
  }, [formatResponseForMode, mode]);
  
  const getResponseLength = useCallback((response: string, targetMode: 'voice' | 'text' = mode) => {
    const formatted = formatResponseForMode(response, targetMode);
    return {
      original: response.length,
      formatted: formatted.length,
      truncated: formatted.length < response.length,
      sentences: formatted.split(/[.!?]+/).filter(s => s.trim().length > 0).length
    };
  }, [formatResponseForMode, mode]);
  
  return {
    formatResponse,
    formatForCurrentMode,
    getResponseLength,
    currentMode: mode
  };
};