// Client/src/types/widget.d.ts - TypeScript definitions
export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type: 'text' | 'audio';
  duration?: number;
}

export interface VoiceSettings {
  inputGain: number;
  outputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface SessionConfig {
  model?: string;
  voice?: string;
  maxDuration?: number;
}

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

export interface VoiceHookReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Voice state
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  
  // Content
  userTranscript: string;
  assistantTranscript: string;
  conversationHistory: VoiceMessage[];
  
  // Settings
  voiceSettings: VoiceSettings;
  setVoiceSettings: (settings: VoiceSettings) => void;
  
  // Actions
  startVoiceMode: () => Promise<boolean>;
  stopVoiceMode: () => void;
  sendTextMessage: (text: string) => void;
  clearConversation: () => void;
  
  // Status
  getStatus: () => string;
  getStatusMessage: () => string;
  
  // Session info
  sessionConfig: any;
}

// Widget initialization function
export interface WidgetInstance {
  destroy: () => void;
}

export declare function initDurmahWidget(
  containerId: string, 
  config?: DurmahWidgetConfig
): WidgetInstance;

// React hook
export declare function useRealtimeWebRTC(): VoiceHookReturn;

// Main widget component
export declare const DurmahWidget: React.FC<DurmahWidgetConfig>;

export default DurmahWidget;