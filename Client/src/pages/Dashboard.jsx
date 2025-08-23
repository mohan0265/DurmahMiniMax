import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Heart, MessageCircle, Sparkles, Mic, Calendar, TrendingUp, Award } from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Student';
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showFloatingHint, setShowFloatingHint] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Hide floating hint after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowFloatingHint(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const getTimeBasedGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 6) return "Working late? 🌙";
    if (hour < 12) return "Good morning! ☀️";
    if (hour < 17) return "Good afternoon! 🌤️";
    if (hour < 22) return "Good evening! 🌆";
    return "Still studying? Take care! 🌙";
  };

  const getMotivationalMessage = () => {
    const messages = [
      "You're doing amazing things! 💜",
      "Every small step counts towards your success! 🦅",
      "I believe in your potential! ✨",
      "Legal studies can be challenging, but you've got this! 💪",
      "Remember to be kind to yourself today! 🌸"
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100">
      {/* Floating Widget Hint */}
      {showFloatingHint && (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          className="fixed bottom-24 right-6 bg-purple-600 text-white p-3 rounded-lg shadow-lg z-40 max-w-xs"
        >
          <div className="text-sm">
            👋 Hey {firstName}! I'm your Legal Eagle Buddy - click the eagle button to start chatting!
          </div>
          <div className="absolute bottom-0 right-8 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-purple-600 transform translate-y-full"></div>
        </motion.div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 5, -5, 0] 
            }}
            transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
            className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mb-6 shadow-lg gentle-glow"
          >
            <span className="text-3xl md:text-4xl float-animation">🦅</span>
          </motion.div>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-2">
            {getTimeBasedGreeting()} {firstName}
          </h1>
          <p className="text-base md:text-lg text-purple-700 font-medium mb-2 bounce-in">
            {getMotivationalMessage()}
          </p>
          <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto px-4">
            I'm Durmah, your compassionate AI companion for Durham Law. Ready to help with studies, wellbeing, or just a friendly chat! 💜
          </p>
        </motion.div>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto mb-12 px-4">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-purple-100"
            onClick={() => {
              // This will trigger the floating widget to open and start voice mode
              const event = new CustomEvent('durmah-action', { 
                detail: { action: 'voice-chat', message: 'Hi Durmah! I\'d like to have a voice conversation.' }
              });
              window.dispatchEvent(event);
            }}
          >
            <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <Mic className="text-purple-600" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2 text-purple-800">Voice Chat</h3>
            <p className="text-gray-600 text-sm">
              Start a natural voice conversation with me right now! 🎤
            </p>
            <div className="mt-3 text-xs text-purple-600 font-medium">
              Click to begin talking →
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-indigo-100"
            onClick={() => {
              const event = new CustomEvent('durmah-action', { 
                detail: { action: 'study-help', message: 'I need help with my legal studies. Can you quiz me or explain some concepts?' }
              });
              window.dispatchEvent(event);
            }}
          >
            <div className="w-12 h-12 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="text-indigo-600" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2 text-indigo-800">Study Help</h3>
            <p className="text-gray-600 text-sm">
              Get help with case law, legal concepts, and Durham Law topics.
            </p>
            <div className="mt-3 text-xs text-indigo-600 font-medium">
              Start studying →
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-rose-100"
            onClick={() => {
              const event = new CustomEvent('durmah-action', { 
                detail: { action: 'wellbeing', message: 'I\'d like to check in about my wellbeing and mental health.' }
              });
              window.dispatchEvent(event);
            }}
          >
            <div className="w-12 h-12 bg-gradient-to-r from-rose-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
              <Heart className="text-rose-600" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2 text-rose-800">Wellbeing Check</h3>
            <p className="text-gray-600 text-sm">
              Let's talk about how you're feeling and managing stress.
            </p>
            <div className="mt-3 text-xs text-rose-600 font-medium">
              Check in now →
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-amber-100"
            onClick={() => {
              const event = new CustomEvent('durmah-action', { 
                detail: { action: 'study-plan', message: 'Can you help me create a study plan and track my progress?' }
              });
              window.dispatchEvent(event);
            }}
          >
            <div className="w-12 h-12 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="text-amber-600" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2 text-amber-800">Study Planning</h3>
            <p className="text-gray-600 text-sm">
              Create personalized study plans and track your progress.
            </p>
            <div className="mt-3 text-xs text-amber-600 font-medium">
              Plan with me →
            </div>
          </motion.div>
        </div>

        {/* How It Works */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-8 shadow-lg max-w-4xl mx-auto mb-12"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center gap-2">
            🎤 Voice-First Experience
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-16 h-16 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <span className="text-2xl">🦅</span>
              </motion.div>
              <h3 className="font-semibold mb-2">Find the Eagle</h3>
              <p className="text-sm text-gray-600">
                Look for the floating eagle button in the bottom-right corner - that's me!
              </p>
            </div>
            
            <div className="text-center">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-16 h-16 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <span className="text-2xl">🗣️</span>
              </motion.div>
              <h3 className="font-semibold mb-2">Just Talk</h3>
              <p className="text-sm text-gray-600">
                Click "Start Talking" and speak naturally - I'll understand and respond with voice!
              </p>
            </div>
            
            <div className="text-center">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-16 h-16 bg-gradient-to-r from-rose-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <span className="text-2xl">💜</span>
              </motion.div>
              <h3 className="font-semibold mb-2">Feel Supported</h3>
              <p className="text-sm text-gray-600">
                I'm here 24/7 for studies, wellbeing support, or just a friendly chat.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Current Time & Wellness Check */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl p-6 shadow-lg max-w-2xl mx-auto mb-12"
        >
          <div className="text-center">
            <h3 className="text-lg font-semibold text-purple-800 mb-2">
              Right now it's {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </h3>
            <p className="text-purple-700 text-sm mb-4">
              {currentTime.getHours() < 6 || currentTime.getHours() > 22 
                ? "Working late? Remember that rest is just as important as study! 🌙"
                : currentTime.getHours() < 12
                ? "Great time for focused learning! Your mind is fresh and ready. ☀️"
                : currentTime.getHours() < 17
                ? "Perfect time to review or tackle challenging topics! 🌤️"
                : "Evening study session? Let's make it productive and calm! 🌆"
              }
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const event = new CustomEvent('durmah-action', { 
                  detail: { action: 'time-check', message: 'Hi Durmah! Can you help me think about how to make good use of my time right now?' }
                });
                window.dispatchEvent(event);
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
            >
              Talk about my day 💜
            </motion.button>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-2">
            Built with 💜 for Durham Law Students
          </p>
          <p className="text-gray-400 text-xs">
            Your conversations are private and secure • I'm here to support, not judge
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
