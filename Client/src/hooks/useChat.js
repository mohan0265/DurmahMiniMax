import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const useChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  useEffect(() => {
    if (user) {
      initializeConversation();
    }
  }, [user]);

  const getAuthHeaders = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        throw new Error('No valid session');
      }
      return {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      console.error('Failed to get auth headers:', error);
      return {};
    }
  };

  const getApiUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      console.error('VITE_API_URL environment variable not set, falling back to localhost in dev');
      return import.meta.env.DEV ? 'http://localhost:3001' : null;
    }
    return apiUrl;
  };

  const initializeConversation = async () => {
    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }
      
      const headers = await getAuthHeaders();
      const response = await axios.post(
        `${apiUrl}/api/chat/conversation`,
        {
          title: 'New Chat',
          topic: 'general'
        },
        { headers }
      );

      setConversationId(response.data.conversation?.id || 'demo');
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
      // Fallback to demo conversation for development
      setConversationId('demo');
    }
  };

  const sendMessage = useCallback(async (message) => {
    if (!conversationId) {
      toast.error('Please wait, initializing chat...');
      return;
    }

    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }
      
      const headers = await getAuthHeaders();
      const response = await axios.post(
        `${apiUrl}/api/chat/message`,
        {
          message,
          conversationId
        },
        { headers }
      );

      // Add AI response
      const aiMessage = {
        id: Date.now() + 1,
        sender: 'durmah',
        text: response.data.message || "I'm here to help! How can I assist you with your legal studies today?",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Fallback response for development/testing
      const fallbackMessage = {
        id: Date.now() + 1,
        sender: 'durmah',
        text: "Hi there! I'm Durmah, your Legal Eagle Buddy. I'm here to help with your studies and wellbeing. What would you like to discuss?",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
      toast.error('Unable to connect to chat service. Using offline mode.');
    } finally {
      setIsTyping(false);
    }
  }, [conversationId]);

  const clearMessages = () => {
    setMessages([]);
    initializeConversation();
  };

  return {
    messages,
    sendMessage,
    isTyping,
    clearMessages
  };
};