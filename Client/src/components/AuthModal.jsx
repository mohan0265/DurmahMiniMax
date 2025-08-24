// Client/src/components/AuthModal.jsx – Google OAuth-only Login
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../contexts/AuthContext';

const AuthModal = ({ isOpen, onClose }) => {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) console.error('Google login error:', error.message);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        >
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
              <p className="text-sm text-gray-600">Use your Durham email to continue</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.4-34.1-4-50.4H272v95.4h146.9c-6.4 34-25.7 62.8-54.6 82.1v68h88.4c51.7-47.6 80.8-117.7 80.8-195.1z"/>
                <path fill="#34A853" d="M272 544.3c73.5 0 135-24.4 179.9-66.1l-88.4-68c-24.5 16.4-55.8 26-91.5 26-70.3 0-129.9-47.5-151.3-111.1H29.6v69.6C73.4 482.6 166.5 544.3 272 544.3z"/>
                <path fill="#FBBC04" d="M120.7 324.6c-10.2-30.2-10.2-62.7 0-92.9V162h-91v69.6c-19.7 38.6-19.7 85.6 0 124.2l91-69.2z"/>
                <path fill="#EA4335" d="M272 107.7c39.9-.6 77.7 14 106.7 40.5l80-80C418.2 25.7 346.3 0 272 0 166.5 0 73.4 61.7 29.6 162l91 69.6c21.4-63.6 81-111.1 151.4-111.1z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AuthModal;