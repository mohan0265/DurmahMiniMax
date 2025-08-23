import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Headphones, Square, Play } from 'lucide-react';
import { useRealtimeWebRTC } from '../hooks/useRealtimeWebRTC'; // ← JS hook
import WellbeingService from '../services/wellbeingService';
import toast from 'react-hot-toast';

const FloatingWidget = () => {
  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [mood, setMood] = useState(null);
  const [voiceMode, setVoiceMode] = useState(true); // default to voice-first
  const [showWelcome, setShowWelcome] = useState(true);
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(false);
  const [moodTrend, setMoodTrend] = useState(null);

  const messagesEndRef = useRef(null);

  // Realtime voice (WebRTC) hook
  const {
    isConnected,
    isListening,
    isSpeaking,
    conversationHistory,
    error,
    startVoiceMode,
    stopVoiceMode,
    sendTextMessage
  } = useRealtimeWebRTC();

  // Voice mode "active" equals a live session (connected)
  const voiceModeActive = !!isConnected;

  // We don’t expose a separate "thinking" signal; approximate it as idle while connected.
  const isThinking = isConnected && !isListening && !isSpeaking ? false : false;

  // Stop voice cleanly when widget closes
  useEffect(() => {
    if (!isOpen && voiceModeActive) {
      stopVoiceMode();
    }
  }, [isOpen, voiceModeActive, stopVoiceMode]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  // Hide welcome after a short while
  useEffect(() => {
    if (!showWelcome) return;
    const t = setTimeout(() => setShowWelcome(false), 6000);
    return () => clearTimeout(t);
  }, [showWelcome]);

  // Start/stop voice mode (ChatGPT-like single toggle)
  const handleVoiceToggle = async () => {
    if (!voiceModeActive) {
      const ok = await startVoiceMode();
      if (!ok) toast.error('Failed to start voice mode. Please try again.');
      else toast.success('Voice mode started', { duration: 1200 });
    } else {
      stopVoiceMode();
      toast('Voice mode stopped', { icon: '🛑', duration: 1200 });
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;
    const text = message;
    setMessage('');
    sendTextMessage(text);
  };

  // Simple status helpers (local)
  const getVoiceStatus = () => {
    if (!isConnected) return 'disconnected';
    if (isSpeaking)   return 'speaking';
    if (isListening)  return 'listening';
    return 'ready';
  };

  const getStatusMessage = () => {
    if (error) return 'Having trouble connecting. Try again!';
    const st = getVoiceStatus();
    if (st === 'disconnected') return 'Connecting to Durmah…';
    if (st === 'listening')    return 'Listening… speak naturally';
    if (st === 'speaking')     return 'Speaking…';
    return 'Ready when you are. Just speak or type!';
  };

  const getDisplayStatus = () => {
    const status = getVoiceStatus();
    const message = getStatusMessage();
    return {
      status,
      message,
      emoji:
        status === 'listening' ? '👂' :
        status === 'speaking'  ? '🗣️' :
        status === 'thinking'  ? '🤔' : '🦅'
    };
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6)  return 'Still studying? Remember to rest! 🌙';
    if (hour < 12) return 'Good morning! Ready to excel today? ☀️';
    if (hour < 17) return 'Good afternoon! How can I help? 🌤️';
    if (hour < 22) return "Good evening! Let's review today's learning! 🌆";
    return "It's late! Quick revision before bed? 🌙";
  };

  const moodEmojis = [
    { emoji: '😊', label: 'Great',        value: 'great' },
    { emoji: '🙂', label: 'Good',         value: 'good' },
    { emoji: '😐', label: 'Okay',         value: 'okay' },
    { emoji: '😰', label: 'Stressed',     value: 'stressed' },
    { emoji: '😔', label: 'Overwhelmed',  value: 'overwhelmed' }
  ];

  const handleMoodSelection = async (selectedMood) => {
    setMood(selectedMood);
    try {
      await WellbeingService.recordMood('me', selectedMood, {
        studyRelated: true,
        timestamp: new Date().toISOString()
      });
      const response = WellbeingService.getEmpathicResponse(selectedMood, { studyRelated: true });
      toast.success(response, { duration: 3000 });
      setTimeout(() => sendTextMessage(`I'm feeling ${selectedMood} right now.`), 600);
      const trend = WellbeingService.getMoodTrend();
      setMoodTrend(trend);
      if (showMoodCheckIn) setShowMoodCheckIn(false);
    } catch {
      /* non-critical */
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div className="fixed bottom-6 right-6 z-50">
            {isConnected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute -top-12 right-0 bg-purple-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap shadow-lg"
              >
                {getDisplayStatus().message}
              </motion.div>
            )}
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsOpen(true)}
              className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white transition-all ${
                voiceModeActive && isListening
                  ? 'bg-red-500 animate-pulse'
                  : voiceModeActive && isSpeaking
                  ? 'bg-green-500 gradient-shift'
                  : voiceModeActive && isThinking
                  ? 'bg-yellow-500 animate-bounce'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-xl gentle-glow'
              }`}
            >
              <span className="text-2xl">{getDisplayStatus().emoji}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-2xl">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getDisplayStatus().emoji}</span>
                  <div>
                    <h3 className="font-bold">Durmah</h3>
                    <p className="text-xs opacity-90">{getDisplayStatus().message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVoiceMode((v) => !v)}
                    className={`p-2 rounded-lg transition ${voiceMode ? 'bg-white/30' : 'hover:bg-white/20'}`}
                    title={voiceMode ? 'Switch to text mode' : 'Switch to voice mode'}
                  >
                    {voiceMode ? <Headphones size={16} /> : <MessageCircle size={16} />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-white/20 rounded-full transition"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Voice Controls - ChatGPT-like */}
              <div className="flex justify-center">
                {voiceMode && (
                  <motion.button
                    onClick={handleVoiceToggle}
                    className={`py-3 px-6 rounded-full transition-all font-semibold text-lg min-w-[200px] ${
                      voiceModeActive
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-white text-purple-600 hover:bg-gray-100'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {voiceModeActive ? (
                      <span className="flex items-center justify-center gap-2">
                        <Square size={20} />
                        Stop Voice Mode
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Play size={20} />
                        Start Voice Mode
                      </span>
                    )}
                  </motion.button>
                )}

                {/* Mood Quick Select (when not in active voice) */}
                {!voiceModeActive && (
                  <div className="flex gap-1">
                    {[
                      { emoji: '😊', label: 'Great', value: 'great' },
                      { emoji: '🙂', label: 'Good', value: 'good' },
                      { emoji: '😐', label: 'Okay', value: 'okay' }
                    ].map((m) => (
                      <button
                        key={m.value}
                        onClick={() => handleMoodSelection(m.value)}
                        className={`p-2 rounded-lg transition ${mood === m.value ? 'bg-white/30' : 'hover:bg-white/20'}`}
                        title={m.label}
                      >
                        <span className="text-sm">{m.emoji}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {showWelcome && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border-l-4 border-purple-500">
                  <p className="text-sm text-purple-900 font-medium">{getGreeting()}</p>
                  <p className="text-xs text-purple-700 mt-2">
                    💜 I'm your Legal Eagle Buddy! {voiceMode ? 'Click "Start Voice Mode" for natural conversation.' : 'Type below or switch to voice mode.'}
                  </p>
                  {voiceMode && (
                    <div className="mt-2 text-xs text-purple-600 bg-purple-100 rounded px-2 py-1">
                      🎤 Voice-first experience — just like ChatGPT!
                    </div>
                  )}
                </div>
              )}

              {/* Voice Status Indicator */}
              {voiceModeActive && (
                <div className="text-center">
                  {isListening && (
                    <div className="bg-blue-100 border border-blue-200 rounded-lg px-4 py-2 text-blue-800 text-sm">
                      🎤 Listening... speak naturally
                    </div>
                  )}
                  {isThinking && (
                    <div className="bg-yellow-100 border border-yellow-200 rounded-lg px-4 py-2 text-yellow-800 text-sm animate-pulse">
                      🤔 Thinking...
                    </div>
                  )}
                  {isSpeaking && (
                    <div className="bg-green-100 border border-green-200 rounded-lg px-4 py-2 text-green-800 text-sm">
                      🗣️ Speaking...
                    </div>
                  )}
                </div>
              )}

              {/* Conversation History */}
              {conversationHistory.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`${
                    msg.sender === 'user'
                      ? 'ml-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                      : 'bg-gradient-to-r from-gray-50 to-purple-50 text-gray-800 border border-purple-100'
                  } rounded-2xl p-3 max-w-[85%] shadow-sm`}
                >
                  <div className="flex items-start gap-2">
                    {msg.sender === 'durmah' && <span className="text-sm mt-0.5">🦅</span>}
                    <div className="flex-1">
                      <p className={`text-sm leading-relaxed ${msg.type === 'streaming' ? 'animate-pulse' : ''}`}>
                        {msg.text}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <span
                          className={`text-xs opacity-70 ${
                            msg.sender === 'user' ? 'text-purple-100' : 'text-gray-500'
                          }`}
                        >
                          {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.type === 'voice' && (
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              msg.sender === 'user' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
                            }`}
                          >
                            🎤 Voice
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Text input (text mode only) */}
            {!voiceMode && (
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message here…"
                    className="flex-1 px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim()}
                    className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">Switch to voice mode for natural conversation</p>
                  <p className="text-xs text-gray-400">Press Enter to send</p>
                </div>
              </div>
            )}

            {/* Voice Mode Footer */}
            {voiceMode && (
              <div className="p-4 border-t bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="text-center">
                  {voiceModeActive ? (
                    <div>
                      <p className="text-sm font-medium text-green-800 mb-2">🎤 Voice Mode Active</p>
                      <p className="text-xs text-green-700">
                        Speak naturally! I'll listen and respond with voice. Conversation appears above.
                      </p>
                      {(isListening || isThinking || isSpeaking) && (
                        <div className="mt-2 text-xs font-medium">
                          {isListening && "🎤 I'm listening..."}
                          {isThinking && '🤔 Thinking about your question...'}
                          {isSpeaking && '🗣️ Speaking my response...'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-purple-800 mb-2">🎤 Voice Mode Ready</p>
                      <p className="text-xs text-purple-600">
                        Click "Start Voice Mode" above for ChatGPT-like conversation. Speak naturally and I'll respond with voice!
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingWidget;
