// Server/services/memory-service.js - Student-aware memory system
const { createClient } = require('@supabase/supabase-js');
const logger = require('../lib/logger');

class MemoryService {
  constructor() {
    this.supabase = null;
    this.initialized = false;
  }

  init() {
    try {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
        logger.warn('Supabase credentials not found, memory service disabled');
        return false;
      }

      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      this.initialized = true;
      logger.info('Memory service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize memory service:', error);
      return false;
    }
  }

  // Save conversation message
  async saveMessage(userId, conversationId, role, content, metadata = {}) {
    if (!this.initialized) return null;

    try {
      const messageData = {
        conversation_id: conversationId,
        sender: role, // 'user', 'durmah', 'system'
        message_text: content,
        message_type: metadata.type || 'text',
        audio_url: metadata.audioUrl,
        audio_duration: metadata.audioDuration,
        response_time_ms: metadata.responseTime,
        tokens_used: metadata.tokensUsed,
        model_used: metadata.model,
        mood_detected: metadata.mood,
        stress_level: metadata.stressLevel,
        sentiment_score: metadata.sentimentScore,
        topics_discussed: metadata.topics || [],
        cases_mentioned: metadata.cases || [],
        legal_concepts: metadata.concepts || [],
        flagged_for_review: metadata.flagged || false,
        contains_crisis_language: metadata.crisisFlag || false,
        metadata: metadata.additional || {}
      };

      const { data, error } = await this.supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        logger.memory.error(userId, 'saveMessage', error);
        return null;
      }

      // Update conversation stats
      await this.updateConversationStats(conversationId);
      
      logger.memory.save(userId, 'message', { 
        messageId: data.id,
        conversationId,
        role 
      });
      
      return data;
    } catch (error) {
      logger.memory.error(userId, 'saveMessage', error);
      return null;
    }
  }

  // Create or get conversation
  async getOrCreateConversation(userId, options = {}) {
    if (!this.initialized) return null;

    try {
      // Try to get active conversation first
      const { data: existing } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_type', options.type || 'chat')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (existing && !options.forceNew) {
        return existing;
      }

      // Create new conversation
      const conversationData = {
        user_id: userId,
        title: options.title || this.generateConversationTitle(),
        topic: options.topic,
        subject_area: options.subject,
        conversation_type: options.type || 'chat',
        mood_start: options.initialMood,
        stress_level_start: options.initialStress,
        key_topics: options.topics || [],
        metadata: options.metadata || {}
      };

      const { data, error } = await this.supabase
        .from('conversations')
        .insert(conversationData)
        .select()
        .single();

      if (error) {
        logger.memory.error(userId, 'createConversation', error);
        return null;
      }

      logger.memory.save(userId, 'conversation', { 
        conversationId: data.id,
        type: options.type 
      });
      
      return data;
    } catch (error) {
      logger.memory.error(userId, 'getOrCreateConversation', error);
      return null;
    }
  }

  // Get user memory/preferences
  async getMemory(userId, key) {
    if (!this.initialized) return null;

    try {
      const { data, error } = await this.supabase
        .from('users')
        .select(`
          preferences,
          study_goals,
          struggling_topics,
          strong_topics,
          stress_triggers,
          coping_strategies,
          support_network
        `)
        .eq('id', userId)
        .single();

      if (error) {
        logger.memory.error(userId, 'getMemory', error);
        return null;
      }

      if (key) {
        return data[key] || null;
      }

      return data;
    } catch (error) {
      logger.memory.error(userId, 'getMemory', error);
      return null;
    }
  }

  // Set user memory/preferences
  async setMemory(userId, key, value) {
    if (!this.initialized) return false;

    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({ 
          [key]: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        logger.memory.error(userId, 'setMemory', error);
        return false;
      }

      logger.memory.save(userId, 'memory', { key, valueType: typeof value });
      return true;
    } catch (error) {
      logger.memory.error(userId, 'setMemory', error);
      return false;
    }
  }

  // Record wellbeing data
  async recordWellbeing(userId, conversationId, data) {
    if (!this.initialized) return null;

    try {
      const wellbeingData = {
        user_id: userId,
        conversation_id: conversationId,
        log_type: data.type || 'mood',
        mood: data.mood,
        stress_level: data.stressLevel,
        energy_level: data.energyLevel,
        motivation_level: data.motivationLevel,
        anxiety_level: data.anxietyLevel,
        log_text: data.text,
        location: data.location,
        activity_before: data.activityBefore,
        triggers: data.triggers || [],
        coping_strategies_used: data.copingStrategies || [],
        needs_support: data.needsSupport || false,
        support_requested: data.supportRequested || false
      };

      const { data: result, error } = await this.supabase
        .from('wellbeing_logs')
        .insert(wellbeingData)
        .select()
        .single();

      if (error) {
        logger.memory.error(userId, 'recordWellbeing', error);
        return null;
      }

      logger.memory.save(userId, 'wellbeing', { 
        type: data.type,
        mood: data.mood 
      });
      
      return result;
    } catch (error) {
      logger.memory.error(userId, 'recordWellbeing', error);
      return null;
    }
  }

  // Get recent conversations
  async getRecentConversations(userId, limit = 10) {
    if (!this.initialized) return [];

    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .select(`
          id,
          title,
          topic,
          subject_area,
          conversation_type,
          started_at,
          ended_at,
          last_message_at,
          message_count,
          productivity_rating,
          helpful_rating
        `)
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.memory.error(userId, 'getRecentConversations', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.memory.error(userId, 'getRecentConversations', error);
      return [];
    }
  }

  // Flag potential crisis situation
  async flagCrisis(userId, conversationId, messageId, data) {
    if (!this.initialized) return false;

    try {
      const crisisData = {
        user_id: userId,
        conversation_id: conversationId,
        message_id: messageId,
        trigger_words: data.triggerWords || [],
        severity_score: data.severityScore || 0,
        message_snippet: data.messageSnippet,
        auto_response_sent: false,
        resources_provided: false,
        support_contacted: false
      };

      const { error } = await this.supabase
        .from('crisis_flags')
        .insert(crisisData);

      if (error) {
        logger.memory.error(userId, 'flagCrisis', error);
        return false;
      }

      logger.integrity.flag(userId, 'crisis_detected', 'high', {
        conversationId,
        severity: data.severityScore
      });
      
      return true;
    } catch (error) {
      logger.memory.error(userId, 'flagCrisis', error);
      return false;
    }
  }

  // Helper methods
  generateConversationTitle() {
    const topics = [
      'Legal Study Session',
      'Case Law Discussion',
      'Exam Preparation',
      'Revision Session',
      'Legal Research',
      'Study Support'
    ];
    return topics[Math.floor(Math.random() * topics.length)];
  }

  async updateConversationStats(conversationId) {
    try {
      const { error } = await this.supabase
        .rpc('increment_conversation_message_count', {
          conv_id: conversationId
        });

      if (error) {
        // Fallback to manual update
        await this.supabase
          .from('conversations')
          .update({ 
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversationId);
      }
    } catch (error) {
      // Silent fail for stats
      logger.debug('Failed to update conversation stats:', error.message);
    }
  }

  async close() {
    if (this.supabase) {
      // Supabase client doesn't need explicit closing
      this.initialized = false;
      logger.info('Memory service closed');
    }
  }
}

// Export singleton instance
module.exports = new MemoryService();