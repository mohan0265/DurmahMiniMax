// [GEMINI PATCH] Created by Gemini on 25 Aug for simplified voice control
import { useRealtimeWebRTC } from './useRealtimeWebRTC';

export const useRealtimeVoice = () => {
  const {
    isConnected,
    isListening,
    voiceModeActive,
    connect,
    startVoiceMode,
    stopVoiceMode,
    conversationHistory,
    sendTextMessage,
    clearConversation,
    error,
    partialTranscript
  } = useRealtimeWebRTC();

  return {
    isConnected,
    isListening,
    voiceModeActive,
    connect,
    startVoiceMode,
    stopVoiceMode,
    conversationHistory,
    sendTextMessage,
    clearConversation,
    error,
    partialTranscript
  };
};