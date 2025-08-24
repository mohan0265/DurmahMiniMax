// [GEMINI PATCH] Inserted by Gemini on 25 Aug for full interactivity
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

  const handleToggleWidget = () => {
    if (isOpen) {
      stopVoiceMode();
      setIsOpen(false);
    } else {
      setIsOpen(true);
      startVoiceMode();
    }
  };

  const handleSendText = (text: string) => {
    if (voiceModeActive) {
      stopVoiceMode();
    }
    sendTextMessage(text);
  };

  const getStatusIndicator = () => {
    if (isConnecting) return <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />;
    if (error) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (isListening) return <Mic className="w-4 h-4 text-green-500 animate-pulse" />;
    if (isSpeaking) return <Volume2 className="w-4 h-4 text-blue-500 animate-pulse" />;
    if (isConnected) return <Wifi className="w-4 h-4 text-purple-500" />;
    return <WifiOff className="w-4 h-4 text-gray-400" />;
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
            className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300 relative overflow-hidden flex items-center justify-center"
          >
            {getStatusIndicator()}
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
                  {partialTranscript && (
                    <MessageBubble message={{ sender: 'user', text: partialTranscript, type: 'voice', timestamp: new Date().toISOString() }} isLatest={true} />
                  )}
                </div>

                <div className="border-t">
                  {error && (
                    <div className="p-3 bg-red-100 text-red-700 text-center">
                      {error}
                    </div>
                  )}
                  <TextInput onSendMessage={handleSendText} disabled={!isConnected} />
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
          placeholder="Type a message..."
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

export default DurmahWidget;