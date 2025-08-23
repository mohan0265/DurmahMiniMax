# 🔧 Durmah Widget Integration Guide

*How to embed the Durmah Voice-Mode Tutor in any React/Next.js application*

## Quick Integration (1-Liner)

### Step 1: Import the Widget Component
```jsx
import { DurmahWidget } from './components/DurmahWidget';
```

### Step 2: Add to Your App
```jsx
function App() {
  return (
    <div>
      {/* Your existing application */}
      <YourExistingComponents />
      
      {/* Add Durmah Voice Widget - One Line! */}
      <DurmahWidget />
    </div>
  );
}
```

## Configuration Options

### Basic Configuration
```jsx
<DurmahWidget 
  apiBase="https://your-backend.onrender.com"
  supabaseUrl="https://your-project.supabase.co"
  supabaseAnonKey="your-anon-key"
/>
```

### Advanced Configuration
```jsx
<DurmahWidget 
  // Backend connection
  apiBase="https://your-backend.onrender.com"
  
  // Supabase configuration
  supabaseUrl="https://your-project.supabase.co"
  supabaseAnonKey="your-anon-key"
  
  // UI customization
  position="bottom-right" // bottom-left, top-right, top-left
  theme="light" // light, dark, auto
  size="normal" // compact, normal, large
  
  // Voice settings
  voice="alloy" // alloy, echo, fable, onyx, nova, shimmer
  autoStart={false} // Don't auto-start voice on page load
  enableCaptions={true} // Show real-time captions
  
  // Accessibility
  highContrast={false} // Enable high contrast mode
  largeText={false} // Enable large text mode
  keyboardNav={true} // Enable keyboard navigation
  
  // Debug (development only)
  debug={false} // Enable debug logging
/>
```

## Demo Route Integration

### Add Demo Page to Your Router
```jsx
// In your router configuration (React Router example)
import { DurmahDemo } from './pages/DurmahDemo';

const router = createBrowserRouter([
  // ... your existing routes
  {
    path: "/durmah-demo",
    element: <DurmahDemo />,
  },
]);
```

### Demo Page Component
```jsx
// pages/DurmahDemo.jsx
import { DurmahWidget } from '../components/DurmahWidget';

export function DurmahDemo() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🦅 Durmah Voice Demo
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your compassionate AI tutor for Durham Law School
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              How to Test Voice Mode:
            </h2>
            <ol className="text-left text-blue-800 space-y-2">
              <li>1. Click the floating voice button (bottom-right)</li>
              <li>2. Grant microphone permission when prompted</li>
              <li>3. Say: "Hello Durmah, help me with contract law"</li>
              <li>4. Experience &lt;1200ms response time</li>
              <li>5. Try interrupting mid-response to test barge-in</li>
            </ol>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800">
              <strong>Note:</strong> Microphone access requires HTTPS. 
              Some corporate networks may block WebRTC (will auto-fallback to WebSocket).
            </p>
          </div>
        </div>
      </div>
      
      {/* The actual widget */}
      <DurmahWidget debug={true} />
    </div>
  );
}
```

---

**Widget Integration Complete!** 🎉

*The Durmah voice widget is now ready to provide compassionate AI tutoring in your application.*