// Client/src/App.jsx - Updated to showcase DurmahWidget
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DurmahWidget from "./components/DurmahWidget";
import { Toaster } from "react-hot-toast";
import "./styles/animations.css";

// Demo page to showcase the widget
function WidgetDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mb-6 shadow-lg">
            <span className="text-4xl">🦅</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Durmah Voice Tutoring Widget
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            ChatGPT-grade voice interaction for Durham Law students
          </p>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Features</h2>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Ultra-low latency voice (&lt;1200ms)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Barge-in interruption (&lt;300ms)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Real-time transcription</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Academic integrity guardrails</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Wellbeing monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">OSCOLA citation guidance</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Drop-in React component</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Mobile responsive</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Usage Example</h2>
          <pre className="bg-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
            <code>{`import DurmahWidget from '@durmah/voice-widget';

function MyApp() {
  return (
    <div>
      {/* Your app content */}
      <h1>My Legal Study App</h1>
      
      {/* Drop in Durmah widget */}
      <DurmahWidget 
        apiBase="https://api.durmah.com"
        position="bottom-right"
        autoStart={false}
        allowTextFallback={true}
        showBranding={true}
      />
    </div>
  );
}`}</code>
          </pre>
        </div>
        
        <div className="text-center mt-8">
          <p className="text-gray-600 mb-2">
            The voice widget is active in the bottom-right corner!
          </p>
          <p className="text-sm text-gray-500">
            Click the floating button to start your conversation with Durmah.
          </p>
        </div>
      </div>
      
      {/* The actual widget */}
      <DurmahWidget 
        apiBase={import.meta.env.VITE_API_BASE}
        position="bottom-right"
        autoStart={false}
        allowTextFallback={true}
        showBranding={true}
        debugMode={import.meta.env.VITE_DEBUG_VOICE === 'true'}
      />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, ready, loading } = useAuth();
  
  // Show loading spinner while auth is initializing
  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mb-6 gentle-glow">
            <span className="text-4xl float-animation">🦅</span>
          </div>
          <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Connecting to Durmah...</p>
          <p className="text-gray-500 text-sm mt-1">Your Legal Eagle Buddy is getting ready</p>
        </div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" replace />;
}

function AuthenticatedRoute({ children }) {
  const { user, ready, loading } = useAuth();
  
  // If still loading, show spinner
  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mb-6 gentle-glow">
            <span className="text-4xl float-animation">🦅</span>
          </div>
          <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Connecting to Durmah...</p>
          <p className="text-gray-500 text-sm mt-1">Your Legal Eagle Buddy is getting ready</p>
        </div>
      </div>
    );
  }
  
  // If user is already authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // If not authenticated, show the login component
  return children;
}

function AppContent() {
  return (
    <>
      <Routes>
        <Route 
          path="/login" 
          element={
            <AuthenticatedRoute>
              <Login />
            </AuthenticatedRoute>
          } 
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route 
          path="/widget-demo" 
          element={<WidgetDemo />} 
        />
        <Route 
          path="/" 
          element={
            // Show widget demo by default, or redirect based on auth
            <WidgetDemo />
          } 
        />
      </Routes>
      
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
            color: 'white',
            fontWeight: '500',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(139, 92, 246, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          },
          success: {
            iconTheme: {
              primary: '#fff',
              secondary: '#8B5CF6'
            }
          },
          error: {
            style: {
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
            }
          }
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}