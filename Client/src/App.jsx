// Client/src/App.jsx - Main app component for voice loop with real auth
import React, { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { VoiceModeProvider } from './contexts/VoiceModeContext'
import DurmahWidget from './components/DurmahWidget'
import AuthModal from './components/AuthModal'
import VoiceIndicator from './components/Voice/VoiceIndicator'
import { Settings, Mic, MicOff, RefreshCw, User, LogIn, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

function AppContent() {
  const [showSettings, setShowSettings] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { user, loading, signOut, displayName, isAuthenticated, hasVoiceAccess } = useAuth()
  
  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch (error) {
      toast.error('Error signing out')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading Durmah...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-800">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="text-2xl">🦅</div>
              <div>
                <h1 className="text-xl font-semibold text-white">Durmah Legal Buddy</h1>
                <p className="text-sm text-purple-200">Your AI Voice Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{displayName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-purple-200">
                        {hasVoiceAccess ? '🎤 Voice Enabled' : '👤 Text Only'}
                      </span>
                      {hasVoiceAccess && (
                        <VoiceIndicator variant="badge" showLabel={false} showModeToggle={false} />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="text-sm">Sign In</span>
                </button>
              )}
              
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-4">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {isAuthenticated ? `Welcome back, ${displayName}!` : 'Meet Your Legal Eagle Buddy'}
            </h2>
            <p className="text-purple-200 max-w-2xl mx-auto">
              {isAuthenticated 
                ? hasVoiceAccess 
                  ? 'Ready for voice conversations? Click the Durmah widget below to start chatting!'
                  : 'You can use text chat. Voice features require a Durham University email.'
                : 'Sign in to unlock personalized AI assistance for your legal studies.'
              }
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <Mic className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Voice Input</h3>
              <p className="text-purple-200 text-sm">
                Real-time microphone capture with noise cancellation and voice activity detection.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <RefreshCw className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Real-time AI</h3>
              <p className="text-purple-200 text-sm">
                Powered by OpenAI's Realtime API for natural, conversational interactions.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <MicOff className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Voice Output</h3>
              <p className="text-purple-200 text-sm">
                High-quality text-to-speech with multiple voice options and natural intonation.
              </p>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Test Environment Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Server Endpoint
                  </label>
                  <input
                    type="text"
                    defaultValue={import.meta.env.VITE_SESSION_ENDPOINT || 'http://localhost:3001/api/realtime/session'}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Backend server URL"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-200">Allow Anonymous Voice</span>
                  <input
                    type="checkbox"
                    defaultChecked={import.meta.env.VITE_ALLOW_ANON_VOICE !== 'false'}
                    className="rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-200">Debug Mode</span>
                  <input
                    type="checkbox"
                    defaultChecked={import.meta.env.NODE_ENV === 'development'}
                    className="rounded"
                  />
                </div>
                
                <div className="pt-4 border-t border-white/20">
                  <p className="text-xs text-purple-300">
                    Environment: {import.meta.env.NODE_ENV || 'development'}<br />
                    Build: {__BUILD_TIME__ || 'unknown'}<br />
                    Version: {__APP_VERSION__ || '1.0.0'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">How to Test</h3>
            <ol className="space-y-2 text-purple-200">
              <li className="flex items-start">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-500 text-white text-xs rounded-full mr-3 mt-0.5">1</span>
                Click the floating Durmah widget in the bottom-right corner
              </li>
              <li className="flex items-start">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-500 text-white text-xs rounded-full mr-3 mt-0.5">2</span>
                Allow microphone access when prompted by your browser
              </li>
              <li className="flex items-start">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-500 text-white text-xs rounded-full mr-3 mt-0.5">3</span>
                Click the microphone button to start voice mode
              </li>
              <li className="flex items-start">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-500 text-white text-xs rounded-full mr-3 mt-0.5">4</span>
                Start speaking naturally - try "Hello, can you help me with contract law?"
              </li>
            </ol>
          </div>
        </main>

        {/* Durmah Widget */}
        <DurmahWidget
          apiBase="/api"
          position="bottom-right"
          showBranding={true}
          allowTextFallback={true}
          autoStart={false}
          debugMode={import.meta.env.NODE_ENV === 'development'}
        />

        {/* Auth Modal */}
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    )
}

function App() {
  return (
    <AuthProvider>
      <VoiceModeProvider>
        <AppContent />
      </VoiceModeProvider>
    </AuthProvider>
  )
}

export default App