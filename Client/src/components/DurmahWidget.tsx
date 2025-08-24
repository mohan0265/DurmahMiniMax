// Client/src/components/DurmahWidget.tsx - Drop-in voice tutoring widget (direct realtime)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Mic,
  MicOff,
  Volume2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
  Minimize2,
  Maximize2,
  Send,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useVoiceMode } from '../contexts/VoiceModeContext';
import { useMode } from '../hooks/useMode';
import { directRealtimeConnect } from '../lib/realtimeDirect.js';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';
import VoiceIndicator from './Voice/VoiceIndicator';

// ========= Public Props =========
export interface DurmahWidgetConfig {
  apiBase?: string;
  theme?: 'light' | 'dark' | 'auto';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  showBranding?: boolean;
  allowTextFallback?: boolean;
  autoStart?: boolean;
  userId?: string;
  sessionToken?: string;
  debugMode?: boolean;
}

// ========= Small UI Bits =========
const StatusIndicator: React.FC<{
  status: string;
  message: string;
  isConnected: boolean;
  onClick?: () => void;
}> = ({ status, message, isConnected, onClick }) => {
  const getStatusColor = () => {
    if (!isConnected) return 'text-gray-400';
    switch (status) {
      case 'listening':
        return 'text-green-500';
      case 'speaking':
        return 'text-blue-500';
      case 'thinking':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-purple-500';
    }
  };

  const getStatusIcon = () => {
    if (!isConnected) return <WifiOff className="w-4 h-4" />;
    switch (status) {
      case 'listening':
        return <Mic className="w-4 h-4 animate-pulse" />;
      case 'speaking':
        return <Volume2 className="w-4 h-4 animate-pulse" />;
      case 'thinking':
        return (
          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        );
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Wifi className="w-4 h-4" />;
    }
  };

  const isClickable = !isConnected && onClick;

  return (
    <div
      className={clsx(
        'flex items-center gap-2 text-sm transition-colors',
        getStatusColor(),
        isClickable && 'cursor-pointer select-none hover:opacity-80'
      )}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      aria-label={isClickable ? 'Click to connect' : undefined}
    >
      {getStatusIcon()}
      <span className="font-medium truncate">{message}</span>
    </div>
  );
};

const VoiceControls: React.FC<{
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  voiceLevel: number;
  onToggleVoice: () => void;
  voiceSettings: any;
  onSettingsChange: (s: any) => void;
}> = ({ isConnected, isListening, isSpeaking, isThinking, voiceLevel, onToggleVoice, voiceSettings, onSettingsChange }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex items-center gap-3 relative">
      {/* Main voice button with visual feedback */}
      <div className="relative">
        <button
          onClick={onToggleVoice}
          disabled={!isConnected}
          className={clsx(
            'relative p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300',
            isConnected
              ? isListening
                ? 'bg-green-500 text-white shadow-lg scale-110 animate-pulse'
                : isSpeaking 
                  ? 'bg-blue-500 text-white shadow-lg'
                  : isThinking
                    ? 'bg-yellow-500 text-white shadow-lg'
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          )}
          title={
            !isConnected ? 'Connecting...' :
            isListening ? 'Listening... speak now' :
            isSpeaking ? 'Durmah is speaking...' :
            isThinking ? 'Thinking...' :
            'Click to speak'
          }
        >
          {/* Pulsing rings for listening state */}
          {isListening && (
            <>
              <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />
              <div className="absolute inset-0 rounded-full bg-green-500 animate-pulse opacity-50" />
            </>
          )}
          
          {/* Progress ring for speaking state */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full border-2 border-blue-300 animate-spin opacity-70" />
          )}
          
          {/* Icon based on state */}
          {isThinking ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isSpeaking ? (
            <Volume2 className="w-5 h-5 animate-pulse" />
          ) : isListening ? (
            <Mic className="w-5 h-5" />
          ) : (
            <MicOff className="w-5 h-5" />
          )}
        </button>
        
        {/* Voice level indicator */}
        {isListening && voiceLevel > 0 && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-100"
              style={{ width: `${Math.min(voiceLevel * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Voice settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {showSettings && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute top-12 right-0 bg-white rounded-lg shadow-xl border p-4 z-50 min-w-[280px]"
        >
          <h3 className="font-semibold text-gray-800 mb-3">Voice Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Input Gain: {Math.round(voiceSettings.inputGain * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={voiceSettings.inputGain}
                onChange={(e) =>
                  onSettingsChange({ ...voiceSettings, inputGain: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output Volume: {Math.round(voiceSettings.outputVolume * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={voiceSettings.outputVolume}
                onChange={(e) =>
                  onSettingsChange({ ...voiceSettings, outputVolume: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Echo Cancellation</span>
              <input
                type="checkbox"
                checked={voiceSettings.echoCancellation}
                onChange={(e) =>
                  onSettingsChange({ ...voiceSettings, echoCancellation: e.target.checked })
                }
                className="rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Noise Suppression</span>
              <input
                type="checkbox"
                checked={voiceSettings.noiseSuppression}
                onChange={(e) =>
                  onSettingsChange({ ...voiceSettings, noiseSuppression: e.target.checked })
                }
                className="rounded"
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const MessageBubble: React.FC<{ message: any; isLatest?: boolean }> = ({ message, isLatest }) => {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex mb-4', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
          isUser ? 'bg-purple-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md',
          isLatest && 'shadow-md'
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div className={clsx('text-xs mt-1 opacity-70', isUser ? 'text-purple-100' : 'text-gray-500')}>
          {message.type === 'audio' && '🎤 '}
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  );
};

const TextInput: React.FC<{ onSendMessage: (t: string) => void; disabled: boolean }> = ({
  onSendMessage,
  disabled,
}) => {
  const [text, setText] = useState('');
  const send = () => {
    if (disabled) return;
    const v = text.trim();
    if (!v) return;
    onSendMessage(v);
    setText('');
  };
  return (
    <div className="flex items-end gap-2 p-3 border-t bg-gray-50">
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message... (or use voice)"
          disabled={disabled}
          rows={1}
          className="w-full p-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />
      </div>
      <button
        onClick={send}
        disabled={disabled}
        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        title="Send message"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
};

const LoginCallout: React.FC<{ onSignIn?: () => void }> = ({ onSignIn }) => (
  <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
    <div className="flex items-center gap-3">
      <div className="text-2xl">🔐</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-purple-800">Sign in to use voice</p>
        <p className="text-xs text-purple-600 mt-1">Voice mode requires authentication for personalized learning</p>
      </div>
      {onSignIn && (
        <button
          onClick={onSignIn}
          className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          Sign In
        </button>
      )}
    </div>
  </div>
);

// ========= Main Widget =========
const DurmahWidget: React.FC<DurmahWidgetConfig> = ({
  apiBase = '/api',
  theme = 'auto',
  position = 'bottom-right',
  primaryColor = '#7c3aed',
  showBranding = true,
  allowTextFallback = true,
  autoStart = false,
  userId,
  sessionToken,
  debugMode = false,
}) => {
  // Env flags + endpoint (these are the lines you asked for)
  const VENV = (import.meta as any)?.env ?? {};
  const ALLOW_ANON = VENV.VITE_ALLOW_ANON_VOICE !== 'false'; // default true
  const REQUIRE_LOGIN = VENV.VITE_REQUIRE_LOGIN === 'true';   // default false
  const RAW_ENDPOINT = (VENV.VITE_SESSION_ENDPOINT || '').trim(); // can be blank; helper will fallback

  // Auth and Voice Mode Context
  const auth = useAuth();
  const voiceMode = useVoiceMode();
  const mode = useMode();
  const user = auth.user;
  const canUseVoice = auth.hasVoiceAccess || (!REQUIRE_LOGIN && ALLOW_ANON);
  const userDisplayName = auth.displayName || user?.displayName || 'there';

  // Local UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);

  // Voice state now managed by VoiceModeContext
  const isListening = voiceMode.isListening;
  const isSpeaking = voiceMode.isSpeaking;
  const isThinking = voiceMode.isThinking;
  const voiceLevel = voiceMode.audioLevel;

  const [voiceSettings, setVoiceSettings] = useState({
    inputGain: 1,
    outputVolume: 1,
    echoCancellation: true,
    noiseSuppression: true,
  });

  // Conversation history managed by VoiceModeContext with proper continuity
  const conversationHistory = voiceMode.conversationHistory;
  const setConversationHistory = (updater: any) => {
    if (typeof updater === 'function') {
      const newHistory = updater(conversationHistory);
      // Add each message through the context
      const lastMessage = newHistory[newHistory.length - 1];
      if (lastMessage && !conversationHistory.find(m => m.id === lastMessage.id)) {
        voiceMode.addMessage(lastMessage);
      }
    }
  };
  const directRef = useRef<{ stop: () => void; sendText?: (t: string) => void } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isThinking]);

  useEffect(() => {
    console.log('[Durmah] endpoint =', RAW_ENDPOINT);
  }, []);

  // Derived status functions
  const getStatus = () => {
    if (!isConnected) return 'disconnected';
    if (isListening) return 'listening';
    if (isSpeaking) return 'speaking';
    if (isThinking) return 'thinking';
    return 'ready';
  };
  const getStatusMessage = () =>
    isConnected ? (isListening ? 'Listening…' : 'Connected') : 'Click to connect';

  // Auto-start if configured
  useEffect(() => {
    if (autoStart && !isConnected) {
      handleConnect();
    }
    // eslint-disable-next-line
  }, [autoStart, isConnected]);

  // ========= Handlers =========
  const handleConnect = async () => {
    try {
      setBanner(null);
      console.log('[Durmah] connect:start');
      if (directRef.current) {
        directRef.current.stop();
        directRef.current = null;
      }
      const handle = await directRealtimeConnect(
        RAW_ENDPOINT,                         // <— use the raw env value; helper will fallback
        (...a: any[]) => console.log(...a),
        { autoGreet: false }  // We'll handle greeting ourselves
      );
      
      // Set up event handlers for voice feedback
      handle.onAudioStart(() => {
        voiceMode.setIsSpeaking(true);
        voiceMode.setIsThinking(false);
      });
      
      handle.onAudioEnd(() => {
        voiceMode.setIsSpeaking(false);
      });
      
      handle.onTranscript((text: string) => {
        const formattedResponse = voiceMode.formatResponseForMode(text, mode.mode);
        voiceMode.addMessage({ 
          role: 'assistant', 
          content: formattedResponse, 
          type: 'voice',
          originalContent: text
        });
      });
      
      directRef.current = handle;
      setIsConnected(true);
      setBanner('🎤 Microphone is live! You can start speaking now.');
      setShowWelcome(false);
      
      // Send personalized greeting
      if (!hasGreeted && canUseVoice) {
        setTimeout(() => {
          const greeting = getPersonalizedVoiceGreeting();
          handle.sendText(greeting);
          setHasGreeted(true);
          voiceMode.addMessage({ 
            role: 'assistant', 
            content: greeting, 
            type: 'greeting' 
          });
        }, 1000);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setBanner('Could not connect: ' + msg);
      setIsConnected(false);
      console.error('[Durmah] connect failed', e);
    }
  };

  const handleMic = async () => {
    try {
      if (!isConnected) {
        await handleConnect();
      }
      
      // Use intelligent mode switching
      const result = await mode.toggle();
      if (!result.success) {
        if (result.reason === 'no_voice_access') {
          setBanner('Voice access not available. Please sign in.');
        } else if (result.reason === 'mic_denied') {
          setBanner('Microphone access denied. Please enable in browser settings.');
        } else {
          setBanner('Voice mode activation failed. Switched to text mode.');
        }
      } else {
        voiceMode.setIsListening(mode.isListening);
        setBanner(mode.isListening ? 'Listening…' : 'Connected. You can start speaking.');
      }
    } catch (e) {
      console.error('[Durmah] mic toggle failed', e);
      setBanner('Mic toggle failed. See console.');
    }
  };

  const handleToggleWidget = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsOpen(false);
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'bottom-6 left-6';
      case 'top-right':
        return 'top-6 right-6';
      case 'top-left':
        return 'top-6 left-6';
      default:
        return 'bottom-6 right-6';
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = userDisplayName === 'there' ? '' : `, ${userDisplayName}`;
    
    if (hour < 6) return `Still studying${name}? Remember to rest! 🌙`;
    if (hour < 12) return `Good morning${name}! Ready to excel today? ☀️`;
    if (hour < 17) return `Good afternoon${name}! How can I help with your studies? 🌤️`;
    if (hour < 22) return `Good evening${name}! Let's review today's learning! 🌆`;
    return `It's late${name}! Quick study session before bed? 🌙`;
  };

  const getPersonalizedVoiceGreeting = () => {
    const hour = new Date().getHours();
    const name = userDisplayName === 'there' ? 'there' : userDisplayName;
    
    if (hour < 12) {
      return `Good morning, ${name}! I'm Durmah, your Legal Eagle Buddy. My microphone is now live and I'm ready to help with your legal studies. How are you feeling today?`;
    } else if (hour < 17) {
      return `Good afternoon, ${name}! I'm listening and ready to assist you with your legal studies. What would you like to work on today?`;
    } else if (hour < 22) {
      return `Good evening, ${name}! I'm here and my mic is active. How can I help you with your studies this evening?`;
    } else {
      return `Hi ${name}! Even though it's late, I'm here to help. My microphone is ready - what legal topic can I assist you with?`;
    }
  };

  const sendTyped = (text: string) => {
    // Add user message with proper mode context
    voiceMode.addMessage({ 
      role: 'user', 
      content: text, 
      type: 'text' 
    });
    
    // Send with conversation context
    const context = voiceMode.getConversationContext();
    directRef.current?.sendText?.(text, context);
  };

  // ========= Render =========
  return (
    <div className={clsx('fixed z-50', getPositionClasses())} ref={widgetRef}>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { background: '#7c3aed', color: 'white' },
        }}
      />

      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleWidget}
            className={clsx(
              'w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300 relative overflow-hidden',
              isConnected ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
            )}
            style={{ backgroundColor: isConnected ? primaryColor : undefined }}
            title={isConnected ? 'Durmah is ready' : 'Click to start Durmah'}
          >
            {isConnected && isListening && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white"
                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0.3, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <MessageCircle className="w-8 h-8" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs">🦅</div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, originX: 1, originY: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0, originX: 1, originY: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={clsx(
              'bg-white rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300',
              isMinimized ? 'w-80 h-16' : 'w-96 h-[32rem] max-w-[90vw] max-h-[80vh] sm:max-w-96 sm:max-h-[32rem]'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🦅</div>
                <div>
                  <h2 className="font-semibold text-sm">Durmah</h2>
                  <p className="text-xs text-purple-100">Your Legal Eagle Buddy</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title={isMinimized ? 'Maximize' : 'Minimize'}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button onClick={handleToggleWidget} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Status with Voice Mode Indicator */}
                <div className="px-4 py-2 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <StatusIndicator status={getStatus()} message={getStatusMessage()} isConnected={isConnected} onClick={handleConnect} />
                    {canUseVoice && (
                      <VoiceIndicator 
                        variant="compact" 
                        showLabel={false} 
                        showModeToggle={true}
                        className="ml-2"
                      />
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[20rem]">
                  {showWelcome && conversationHistory.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
                      <div className="text-4xl mb-2">🦅</div>
                      <h3 className="font-semibold text-gray-800 mb-1">Hello! I'm Durmah</h3>
                      <p className="text-sm text-gray-600 mb-4">{getGreeting()}</p>
                      <p className="text-xs text-gray-500">
                        {canUseVoice ? 'Click the microphone to speak, or type below to chat!' : 'Sign in to unlock voice mode, or browse as guest!'}
                      </p>
                      {!user && ALLOW_ANON && (
                        <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-800">🌟 Anonymous mode enabled - voice features available without login!</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {conversationHistory.map((m, i) => (
                    <MessageBubble key={m.id} message={m} isLatest={i === conversationHistory.length - 1} />
                  ))}

                  {isThinking && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-4">
                      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Controls */}
                <div className="border-t">
                  {canUseVoice ? (
                    <>
                      <div className="flex items-center justify-between p-3 bg-gray-50">
                        <VoiceControls
                          isConnected={isConnected}
                          isListening={isListening}
                          isSpeaking={isSpeaking}
                          isThinking={isThinking}
                          voiceLevel={voiceLevel}
                          onToggleVoice={handleMic}
                          voiceSettings={voiceSettings}
                          onSettingsChange={setVoiceSettings}
                        />
                        <div className="flex items-center gap-2">
                          {conversationHistory.length > 0 && (
                            <button
                              onClick={() => voiceMode.clearConversation()}
                              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                              title="Clear conversation"
                            >
                              Clear
                            </button>
                          )}
                          <VoiceIndicator 
                            variant="badge" 
                            showLabel={true} 
                            showModeToggle={false}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 bg-gray-50">
                      <LoginCallout
                        onSignIn={() => {
                          window.location.href = '/login';
                        }}
                      />
                    </div>
                  )}

                  {banner && (
                    <div className="mx-3 my-2 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-900">{banner}</div>
                  )}

                  {allowTextFallback && canUseVoice && (
                    <TextInput onSendMessage={sendTyped} disabled={!isConnected} />
                  )}
                </div>
              </>
            )}

            {showBranding && !isMinimized && (
              <div className="px-4 py-1 bg-gray-50 border-t">
                <p className="text-xs text-gray-400 text-center">Built with ❤️ for Durham Law Students</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DurmahWidget;
