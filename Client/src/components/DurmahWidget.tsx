// [GEMINI PATCH] Inserted by Gemini on 25 Aug for mic initialization
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
  Save,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeVoice } from '../hooks/useRealtimeVoice';
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
  isConnecting: boolean;
  onClick?: () => void;
}> = ({ status, message, isConnected, isConnecting, onClick }) => {
  const getStatusColor = () => {
    if (isConnecting) return 'text-yellow-500';
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
    if (isConnecting) return <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />;
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

  return (
    <div
      className={clsx(
        'flex items-center gap-2 text-sm transition-colors',
        getStatusColor(),
      )}
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
  const isUser = message.sender === 'user';
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
        <div className="whitespace-pre-wrap break-words">{message.text}</div>
        <div className={clsx('text-xs mt-1 opacity-70', isUser ? 'text-purple-100' : 'text-gray-500')}>
          {message.type === 'voice' && '🎤 '}
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

// ========= Main Widget =========
const DurmahWidget: React.FC<DurmahWidgetConfig> = ({
  position = 'bottom-right',
  primaryColor = '#7c3aed',
  showBranding = true,
  allowTextFallback = true,
}) => {
  const { user } = useAuth();
  const {
    isConnected,
    isConnecting,
    isListening,
    voiceModeActive,
    connect,
    startVoiceMode,
    stopVoiceMode,
    conversationHistory,
    sendTextMessage,
    clearConversation,
    error,
  } = useRealtimeVoice();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggleWidget = () => {
    if (isOpen) {
      stopVoiceMode();
      setIsOpen(false);
    } else {
      setIsOpen(true);
      startVoiceMode();
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

  return (
    <div className={clsx('fixed z-50', getPositionClasses())}>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { background: '#7c3aed', color: 'white' },
        }}
      />

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
              'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
            )}
            style={{ backgroundColor: primaryColor }}
            title={'Click to start Durmah'}
          >
            <MessageCircle className="w-8 h-8" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs">🦅</div>
          </motion.button>
        )}
      </AnimatePresence>

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
                <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[20rem]">
                  {conversationHistory.map((m, i) => (
                    <MessageBubble key={m.id} message={m} isLatest={i === conversationHistory.length - 1} />
                  ))}
                </div>

                <div className="border-t">
                  {error && (
                    <div className="p-3 bg-red-100 text-red-700 text-center">
                      ❌ Voice mode not available. Please use text chat.
                    </div>
                  )}
                  <TextInput onSendMessage={sendTextMessage} disabled={!voiceModeActive} />
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DurmahWidget;
