// Client/src/components/DurmahWidget.tsx - Drop-in voice tutoring widget
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Settings, 
  Minimize2,
  Maximize2,
  Send,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useRealtimeWebRTC } from '../hooks/useRealtimeWebRTC';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

// Widget configuration interface
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

// Status indicator component
const StatusIndicator: React.FC<{ 
  status: string; 
  message: string; 
  isConnected: boolean;
}> = ({ status, message, isConnected }) => {
  const getStatusColor = () => {
    if (!isConnected) return 'text-gray-400';
    switch (status) {
      case 'listening': return 'text-green-500';
      case 'speaking': return 'text-blue-500';
      case 'thinking': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-purple-500';
    }
  };
  
  const getStatusIcon = () => {
    if (!isConnected) return <WifiOff className="w-4 h-4" />;
    switch (status) {
      case 'listening': return <Mic className="w-4 h-4 animate-pulse" />;
      case 'speaking': return <Volume2 className="w-4 h-4 animate-pulse" />;
      case 'thinking': return <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Wifi className="w-4 h-4" />;
    }
  };
  
  return (
    <div className={clsx(
      'flex items-center gap-2 text-sm transition-colors',
      getStatusColor()
    )}>
      {getStatusIcon()}
      <span className="font-medium truncate">{message}</span>
    </div>
  );
};

// Voice controls component
const VoiceControls: React.FC<{
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  onToggleVoice: () => void;
  voiceSettings: any;
  onSettingsChange: (settings: any) => void;
}> = ({ isConnected, isListening, isSpeaking, onToggleVoice, voiceSettings, onSettingsChange }) => {
  const [showSettings, setShowSettings] = useState(false);
  
  return (
    <div className="flex items-center gap-2">
      {/* Main voice toggle */}
      <button
        onClick={onToggleVoice}
        disabled={!isConnected}
        className={clsx(
          'p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300',
          isConnected
            ? isListening
              ? 'bg-green-500 text-white shadow-lg scale-110'
              : isSpeaking
              ? 'bg-blue-500 text-white shadow-lg'
              : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        )}
        title={isConnected ? (isListening ? 'Listening...' : 'Click to speak') : 'Connecting...'}
      >
        {isListening ? (
          <Mic className="w-5 h-5 animate-pulse" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
      </button>
      
      {/* Settings toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Voice settings"
      >
        <Settings className="w-4 h-4" />
      </button>
      
      {/* Settings panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute top-16 right-0 bg-white rounded-lg shadow-xl border p-4 z-50 min-w-[280px]"
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
                onChange={(e) => onSettingsChange({
                  ...voiceSettings,
                  inputGain: parseFloat(e.target.value)
                })}
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
                onChange={(e) => onSettingsChange({
                  ...voiceSettings,
                  outputVolume: parseFloat(e.target.value)
                })}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Echo Cancellation</span>
              <input
                type="checkbox"
                checked={voiceSettings.echoCancellation}
                onChange={(e) => onSettingsChange({
                  ...voiceSettings,
                  echoCancellation: e.target.checked
                })}
                className="rounded"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Noise Suppression</span>
              <input
                type="checkbox"
                checked={voiceSettings.noiseSuppression}
                onChange={(e) => onSettingsChange({
                  ...voiceSettings,
                  noiseSuppression: e.target.checked
                })}
                className="rounded"
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Message bubble component
const MessageBubble: React.FC<{ message: any; isLatest?: boolean }> = ({ message, isLatest }) => {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'flex mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={clsx(
        'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
        isUser 
          ? 'bg-purple-600 text-white rounded-br-md'
          : 'bg-gray-100 text-gray-800 rounded-bl-md',
        isLatest && 'shadow-md'
      )}>
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div className={clsx(
          'text-xs mt-1 opacity-70',
          isUser ? 'text-purple-100' : 'text-gray-500'
        )}>
          {message.type === 'audio' && '🎤 '}
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </motion.div>
  );
};

// Text input component
const TextInput: React.FC<{
  onSendMessage: (text: string) => void;
  disabled: boolean;
}> = ({ onSendMessage, disabled }) => {
  const [text, setText] = useState('');
  
  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSendMessage(text.trim());
      setText('');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="flex items-end gap-2 p-3 border-t bg-gray-50">
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message... (or use voice)"
          disabled={disabled}
          rows={1}
          className="w-full p-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />
      </div>
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        title="Send message"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
};

// Main widget component
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
  debugMode = false
}) => {
  // Widget state
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  
  // Voice hook
  const {
    isConnected,
    isConnecting,
    connectionError,
    isListening,
    isSpeaking,
    isThinking,
    conversationHistory,
    voiceSettings,
    setVoiceSettings,
    startVoiceMode,
    stopVoiceMode,
    sendTextMessage,
    clearConversation,
    getStatus,
    getStatusMessage
  } = useRealtimeWebRTC();
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isThinking]);
  
  // Auto-start if configured
  useEffect(() => {
    if (autoStart && !isConnected && !isConnecting) {
      handleToggleVoice();
    }
  }, [autoStart, isConnected, isConnecting]);
  
  // Handle voice toggle
  const handleToggleVoice = async () => {
    if (isConnected) {
      stopVoiceMode();
      toast('Voice mode stopped', { icon: '🛑' });
    } else {
      const success = await startVoiceMode();
      if (success) {
        toast.success('Voice mode started! Speak naturally.');
      } else {
        toast.error('Failed to start voice mode. Check your microphone permissions.');
      }
    }
  };
  
  // Handle widget open/close
  const handleToggleWidget = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else {
      setIsOpen(false);
      // Optionally stop voice when closing
      // stopVoiceMode();
    }
  };
  
  // Get position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left': return 'bottom-6 left-6';
      case 'top-right': return 'top-6 right-6';
      case 'top-left': return 'top-6 left-6';
      default: return 'bottom-6 right-6';
    }
  };
  
  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Still studying? Remember to rest! 🌙';
    if (hour < 12) return 'Good morning! Ready to excel today? ☀️';
    if (hour < 17) return 'Good afternoon! How can I help with your studies? 🌤️';
    if (hour < 22) return "Good evening! Let's review today's learning! 🌆";
    return "It's late! Quick study session before bed? 🌙";
  };
  
  return (
    <div className={clsx('fixed z-50', getPositionClasses())} ref={widgetRef}>
      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 3000,
          style: {
            background: '#7c3aed',
            color: 'white'
          }
        }} 
      />
      
      {/* Floating Action Button */}
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
              isConnected
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
            )}
            style={{ backgroundColor: isConnected ? primaryColor : undefined }}
            title={isConnected ? 'Durmah is ready' : 'Click to start Durmah'}
          >
            {/* Status indicator ring */}
            {isConnected && (isListening || isSpeaking) && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.7, 0.3, 0.7]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
            
            {/* Main icon */}
            {isConnecting ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <MessageCircle className="w-8 h-8" />
            )}
            
            {/* Eagle badge */}
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs">
              🦅
            </div>
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Expanded Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, originX: 1, originY: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0, originX: 1, originY: 1 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className={clsx(
              'bg-white rounded-2xl shadow-2xl border overflow-hidden',
              isMinimized ? 'w-80 h-16' : 'w-96 h-[32rem]',
              'transition-all duration-300'
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
                
                <button
                  onClick={handleToggleWidget}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {!isMinimized && (
              <>
                {/* Status Bar */}
                <div className="px-4 py-2 bg-gray-50 border-b">
                  <StatusIndicator 
                    status={getStatus()} 
                    message={getStatusMessage()}
                    isConnected={isConnected}
                  />
                </div>
                
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[20rem]">
                  {/* Welcome message */}
                  {showWelcome && conversationHistory.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8"
                    >
                      <div className="text-4xl mb-2">🦅</div>
                      <h3 className="font-semibold text-gray-800 mb-1">Hello! I'm Durmah</h3>
                      <p className="text-sm text-gray-600 mb-4">{getGreeting()}</p>
                      <p className="text-xs text-gray-500">
                        Click the microphone to speak, or type below to chat!
                      </p>
                    </motion.div>
                  )}
                  
                  {/* Conversation history */}
                  {conversationHistory.map((message, index) => (
                    <MessageBubble 
                      key={message.id} 
                      message={message} 
                      isLatest={index === conversationHistory.length - 1}
                    />
                  ))}
                  
                  {/* Thinking indicator */}
                  {isThinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start mb-4"
                    >
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
                  {/* Voice Controls */}
                  <div className="flex items-center justify-between p-3 bg-gray-50">
                    <VoiceControls
                      isConnected={isConnected}
                      isListening={isListening}
                      isSpeaking={isSpeaking}
                      onToggleVoice={handleToggleVoice}
                      voiceSettings={voiceSettings}
                      onSettingsChange={setVoiceSettings}
                    />
                    
                    {/* Additional controls */}
                    <div className="flex items-center gap-2">
                      {conversationHistory.length > 0 && (
                        <button
                          onClick={clearConversation}
                          className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          title="Clear conversation"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Text Input (if enabled) */}
                  {allowTextFallback && (
                    <TextInput
                      onSendMessage={sendTextMessage}
                      disabled={!isConnected}
                    />
                  )}
                </div>
              </>
            )}
            
            {/* Branding */}
            {showBranding && !isMinimized && (
              <div className="px-4 py-1 bg-gray-50 border-t">
                <p className="text-xs text-gray-400 text-center">
                  Built with ❤️ for Durham Law Students
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DurmahWidget;