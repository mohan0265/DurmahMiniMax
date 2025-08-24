// [CLAUDE PATCH] Modernized by Claude for ChatGPT/Perplexity style design
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
  Zap,
  Brain,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeVoice } from '../hooks/useRealtimeVoice';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

// ========= Main Widget =========
const DurmahWidget: React.FC = () => {
  const { user } = useAuth();
  const {
    isConnected,
    isConnecting,
    isListening,
    isSpeaking,
    voiceModeActive,
    connect,
    startVoiceMode,
    stopVoiceMode,
    conversationHistory,
    sendTextMessage,
    clearConversation,
    partialTranscript,
    error,
  } = useRealtimeVoice();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleToggleWidget = () => {
    if (isOpen) {
      if (voiceModeActive) stopVoiceMode();
      setIsOpen(false);
    } else {
      setIsOpen(true);
      // Auto-start voice mode if preferred and available
      if (inputMode === 'voice' && isConnected) {
        startVoiceMode();
      }
    }
  };

  const handleToggleInputMode = () => {
    if (inputMode === 'voice') {
      if (voiceModeActive) stopVoiceMode();
      setInputMode('text');
      toast('📝 Switched to text mode', { duration: 2000 });
    } else {
      setInputMode('voice');
      startVoiceMode();
      toast('🎤 Switched to voice mode', { duration: 2000 });
    }
  };

  const handleSendText = (text: string) => {
    if (voiceModeActive) {
      stopVoiceMode();
      setInputMode('text');
    }
    sendTextMessage(text);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory, partialTranscript]);

  const getFloatingButtonContent = () => {
    if (isListening) {
      return (
        <div className="relative">
          <Mic className="w-6 h-6 text-white" />
          <div className="absolute -inset-4 rounded-full bg-white/20 animate-ping" />
        </div>
      );
    }
    if (isSpeaking) {
      return (
        <div className="relative">
          <Volume2 className="w-6 h-6 text-white animate-pulse" />
          <div className="absolute -inset-4 rounded-full bg-white/20 animate-pulse" />
        </div>
      );
    }
    if (isConnecting) {
      return <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />;
    }
    if (error) {
      return <AlertTriangle className="w-6 h-6 text-white" />;
    }
    return <Brain className="w-6 h-6 text-white" />;
  };

  const getModeIndicator = () => {
    if (inputMode === 'voice') {
      if (isListening) return { icon: <Mic className="w-4 h-4" />, text: 'Listening...', color: 'text-green-600' };
      if (isSpeaking) return { icon: <Volume2 className="w-4 h-4" />, text: 'Speaking...', color: 'text-blue-600' };
      if (isConnected) return { icon: <Mic className="w-4 h-4" />, text: 'Voice Ready', color: 'text-purple-600' };
      return { icon: <MicOff className="w-4 h-4" />, text: 'Voice Offline', color: 'text-gray-500' };
    }
    return { icon: <MessageCircle className="w-4 h-4" />, text: 'Text Mode', color: 'text-gray-600' };
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Toaster position="top-center" />

      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleWidget}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300/50 relative overflow-hidden flex items-center justify-center backdrop-blur-sm"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #4f46e5 100%)',
            }}
          >
            {getFloatingButtonContent()}
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
              'bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden transition-all duration-300',
              isMinimized ? 'w-80 h-16' : 'w-[28rem] h-[36rem] max-w-[90vw] max-h-[85vh] sm:max-w-[28rem] sm:max-h-[36rem]'
            )}
            style={{
              backdropFilter: 'blur(20px) saturate(180%)',
              background: 'rgba(255, 255, 255, 0.98)'
            }}
          >
            {/* Modern Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-600/10 via-purple-500/10 to-indigo-600/10 border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    Durmah
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className={clsx('flex items-center gap-1 text-xs', getModeIndicator().color)}>
                      {getModeIndicator().icon}
                      <span className="font-medium">{getModeIndicator().text}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleToggleInputMode}
                  className={clsx(
                    'p-2 rounded-xl transition-all duration-200 text-xs font-medium',
                    inputMode === 'voice' 
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                  title={inputMode === 'voice' ? 'Switch to text mode' : 'Switch to voice mode'}
                >
                  {inputMode === 'voice' ? <Mic className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
                  title={isMinimized ? 'Maximize' : 'Minimize'}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={handleToggleWidget} 
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600" 
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Modern Messages Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[24rem]">
                  {conversationHistory.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to help!</h3>
                      <p className="text-gray-500 text-sm max-w-xs mx-auto">
                        {inputMode === 'voice' 
                          ? 'Start speaking or click the mic button to begin our conversation.' 
                          : 'Type your message below to start chatting with your legal assistant.'}
                      </p>
                    </div>
                  )}
                  {conversationHistory.map((m, i) => (
                    <ModernMessage key={m.id} message={m} isLatest={i === conversationHistory.length - 1} />
                  ))}
                  {partialTranscript && (
                    <ModernMessage 
                      message={{ 
                        sender: 'user', 
                        text: partialTranscript, 
                        type: 'voice', 
                        timestamp: new Date().toISOString() 
                      }} 
                      isLatest={true}
                      isPartial={true}
                    />
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Modern Input Area */}
                <div className="border-t border-gray-200/50 bg-gray-50/50">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-6 py-3 bg-red-50 text-red-700 text-center text-sm font-medium border-b border-red-100"
                    >
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      {error}
                    </motion.div>
                  )}
                  {inputMode === 'voice' ? (
                    <VoiceInput 
                      isListening={isListening}
                      isSpeaking={isSpeaking}
                      isConnected={isConnected}
                      onToggleVoice={voiceModeActive ? stopVoiceMode : startVoiceMode}
                    />
                  ) : (
                    <ModernTextInput onSendMessage={handleSendText} disabled={!isConnected} />
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Modern Message Component - ChatGPT/Perplexity style
const ModernMessage: React.FC<{ 
  message: any; 
  isLatest?: boolean; 
  isPartial?: boolean; 
}> = ({ message, isLatest, isPartial }) => {
  const isUser = message.sender === 'user';
  const isDurmah = message.sender === 'durmah';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
          isUser 
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
            : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white'
        )}>
          {isUser ? '👤' : <Brain className="w-4 h-4" />}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">
              {isUser ? 'You' : 'Durmah'}
            </span>
            {message.type === 'voice' && (
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <Zap className="w-3 h-3" />
                <span>Voice</span>
              </div>
            )}
            {isPartial && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" />
                <span>Speaking...</span>
              </div>
            )}
          </div>
          
          <div className={clsx(
            'text-gray-800 text-sm leading-relaxed',
            isPartial && 'opacity-70'
          )}>
            <div className="whitespace-pre-wrap break-words">
              {message.text}
              {isPartial && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block w-0.5 h-4 bg-purple-500 ml-1"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <span>
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Voice Input Component
const VoiceInput: React.FC<{
  isListening: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
  onToggleVoice: () => void;
}> = ({ isListening, isSpeaking, isConnected, onToggleVoice }) => {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggleVoice}
          disabled={!isConnected}
          className={clsx(
            'relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4',
            isListening 
              ? 'bg-green-500 text-white focus:ring-green-300 shadow-lg shadow-green-500/30' 
              : isSpeaking
              ? 'bg-blue-500 text-white focus:ring-blue-300 shadow-lg shadow-blue-500/30'
              : isConnected
              ? 'bg-purple-600 text-white focus:ring-purple-300 hover:bg-purple-700 shadow-lg shadow-purple-600/30'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          )}
        >
          {isListening ? (
            <>
              <Mic className="w-6 h-6" />
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
            </>
          ) : isSpeaking ? (
            <>
              <Volume2 className="w-6 h-6 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />
            </>
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </motion.button>
      </div>
      
      <div className="text-center mt-3">
        <p className="text-sm font-medium text-gray-700">
          {isListening 
            ? 'Listening...' 
            : isSpeaking 
            ? 'Speaking...'
            : isConnected 
            ? 'Click to speak'
            : 'Connecting...'}
        </p>
        {isListening && (
          <div className="flex justify-center gap-1 mt-2">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1 h-6 bg-green-500 rounded-full"
                animate={{
                  scaleY: [1, 2, 1],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Modern Text Input Component
const ModernTextInput: React.FC<{ 
  onSendMessage: (t: string) => void; 
  disabled: boolean;
}> = ({ onSendMessage, disabled }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    if (disabled) return;
    const v = text.trim();
    if (!v) return;
    onSendMessage(v);
    setText('');
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

  return (
    <div className="px-6 py-4">
      <div className="flex items-end gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:border-purple-300 focus-within:shadow-md transition-all duration-200">
        <div className="flex-1 min-h-0">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type your message..."
            disabled={disabled}
            rows={1}
            className="w-full p-4 text-sm resize-none focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed placeholder-gray-400"
            style={{ minHeight: '52px', maxHeight: '120px' }}
          />
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={send}
          disabled={disabled || !text.trim()}
          className={clsx(
            'flex-shrink-0 w-10 h-10 m-1 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300',
            text.trim() && !disabled
              ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/30'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
      
      <div className="flex justify-between items-center mt-2 px-1">
        <div className="text-xs text-gray-500">
          {disabled ? 'Connecting...' : 'Enter to send, Shift+Enter for new line'}
        </div>
        {text.length > 0 && (
          <div className="text-xs text-gray-400">
            {text.length}/2000
          </div>
        )}
      </div>
    </div>
  );
};

export default DurmahWidget;