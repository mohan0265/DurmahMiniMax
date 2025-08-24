// Server/services/memory-service.js - Memory and conversation management
const logger = require('../lib/logger');

class MemoryService {
  constructor() {
    this.conversations = new Map();
    this.userProfiles = new Map();
    this.contextWindow = 10; // Number of recent interactions to keep in context
  }

  // Store conversation memory
  storeConversation(userId, sessionId, interaction) {
    const key = `${userId}_${sessionId}`;
    
    if (!this.conversations.has(key)) {
      this.conversations.set(key, {
        userId,
        sessionId,
        created: new Date(),
        interactions: [],
        context: {},
        summary: null
      });
    }
    
    const conversation = this.conversations.get(key);
    conversation.interactions.push({
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...interaction
    });
    
    // Keep only recent interactions for context
    if (conversation.interactions.length > this.contextWindow * 2) {
      conversation.interactions = conversation.interactions.slice(-this.contextWindow);
    }
    
    // Update conversation context
    this.updateConversationContext(conversation);
    
    logger.memory.store(userId, 'conversation_interaction', {
      sessionId,
      interactionCount: conversation.interactions.length
    });
    
    return conversation;
  }

  // Retrieve conversation history
  getConversation(userId, sessionId) {
    const key = `${userId}_${sessionId}`;
    const conversation = this.conversations.get(key);
    
    if (conversation) {
      logger.memory.retrieve(userId, 'conversation', 1, { sessionId });
      return {
        ...conversation,
        recentContext: this.buildRecentContext(conversation)
      };
    }
    
    logger.memory.retrieve(userId, 'conversation', 0, { sessionId });
    return null;
  }

  // Update conversation context based on recent interactions
  updateConversationContext(conversation) {
    const recentInteractions = conversation.interactions.slice(-this.contextWindow);
    
    // Extract topics from recent interactions
    const topics = new Set();
    const entities = new Set();
    const sentiments = [];
    
    for (const interaction of recentInteractions) {
      // Simple topic extraction (in production, use NLP)
      if (interaction.user_input) {
        const words = interaction.user_input.toLowerCase().split(/\s+/);
        const legalTerms = [
          'contract', 'tort', 'criminal', 'constitutional', 'property',
          'case law', 'statute', 'precedent', 'jurisdiction', 'appeal',
          'evidence', 'procedure', 'rights', 'liability', 'damages'
        ];
        
        for (const term of legalTerms) {
          if (words.includes(term)) {
            topics.add(term);
          }
        }
      }
      
      // Extract sentiment indicators
      if (interaction.user_input) {
        const stressIndicators = ['stressed', 'overwhelmed', 'confused', 'lost', 'help'];
        const positiveIndicators = ['understand', 'clear', 'helpful', 'good', 'thanks'];
        
        const hasStress = stressIndicators.some(indicator => 
          interaction.user_input.toLowerCase().includes(indicator)
        );
        const hasPositive = positiveIndicators.some(indicator => 
          interaction.user_input.toLowerCase().includes(indicator)
        );
        
        if (hasStress) sentiments.push('stressed');
        if (hasPositive) sentiments.push('positive');
      }
    }
    
    conversation.context = {
      topics: Array.from(topics),
      entities: Array.from(entities),
      recent_sentiment: this.analyzeSentimentTrend(sentiments),
      interaction_count: conversation.interactions.length,
      last_updated: new Date(),
      study_focus: this.inferStudyFocus(topics),
      support_needs: this.assessSupportNeeds(recentInteractions)
    };
  }

  buildRecentContext(conversation) {
    const recent = conversation.interactions.slice(-5); // Last 5 interactions
    
    return {
      summary: this.summarizeRecentInteractions(recent),
      key_topics: conversation.context.topics || [],
      emotional_state: conversation.context.recent_sentiment || 'neutral',
      study_focus: conversation.context.study_focus || 'general',
      needs_support: conversation.context.support_needs || false
    };
  }

  summarizeRecentInteractions(interactions) {
    if (interactions.length === 0) return 'No recent interactions';
    
    const topics = new Set();
    let questionCount = 0;
    let hasConfusion = false;
    
    for (const interaction of interactions) {
      if (interaction.type === 'question') questionCount++;
      
      if (interaction.user_input) {
        const input = interaction.user_input.toLowerCase();
        
        // Extract main topics
        if (input.includes('contract')) topics.add('contracts');
        if (input.includes('tort')) topics.add('torts');
        if (input.includes('criminal')) topics.add('criminal law');
        if (input.includes('constitutional')) topics.add('constitutional law');
        if (input.includes('case') || input.includes('precedent')) topics.add('case law');
        
        // Check for confusion indicators
        if (input.includes('confused') || input.includes('don\'t understand')) {
          hasConfusion = true;
        }
      }
    }
    
    let summary = `Recent ${interactions.length} interactions`;
    if (topics.size > 0) {
      summary += ` focused on ${Array.from(topics).join(', ')}`;
    }
    if (hasConfusion) {
      summary += '. Student showing confusion';
    }
    if (questionCount > interactions.length * 0.7) {
      summary += '. High question activity';
    }
    
    return summary;
  }

  analyzeSentimentTrend(sentiments) {
    if (sentiments.length === 0) return 'neutral';
    
    const stressCount = sentiments.filter(s => s === 'stressed').length;
    const positiveCount = sentiments.filter(s => s === 'positive').length;
    
    if (stressCount > positiveCount) return 'stressed';
    if (positiveCount > stressCount) return 'positive';
    return 'mixed';
  }

  inferStudyFocus(topics) {
    if (topics.length === 0) return 'general';
    
    // Map topics to broader study areas
    const areaMapping = {
      'contract': 'Contract Law',
      'tort': 'Tort Law',
      'criminal': 'Criminal Law',
      'constitutional': 'Constitutional Law',
      'property': 'Property Law',
      'case law': 'Legal Research',
      'statute': 'Statutory Interpretation',
      'precedent': 'Case Analysis',
      'evidence': 'Evidence Law',
      'procedure': 'Legal Procedure'
    };
    
    const areas = new Set();
    for (const topic of topics) {
      if (areaMapping[topic]) {
        areas.add(areaMapping[topic]);
      }
    }
    
    if (areas.size === 1) {
      return Array.from(areas)[0];
    } else if (areas.size > 1) {
      return `Multiple areas: ${Array.from(areas).join(', ')}`;
    }
    
    return 'general';
  }

  assessSupportNeeds(interactions) {
    const supportIndicators = [
      'stressed', 'overwhelmed', 'confused', 'lost', 'struggling',
      'don\'t understand', 'help me', 'difficult', 'hard'
    ];
    
    let supportSignals = 0;
    for (const interaction of interactions) {
      if (interaction.user_input) {
        const input = interaction.user_input.toLowerCase();
        for (const indicator of supportIndicators) {
          if (input.includes(indicator)) {
            supportSignals++;
            break;
          }
        }
      }
    }
    
    return supportSignals >= interactions.length * 0.3; // 30% threshold
  }

  // User profile management
  updateUserProfile(userId, updates) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        created: new Date(),
        preferences: {},
        learning_style: null,
        study_patterns: {},
        wellbeing_indicators: {}
      });
    }
    
    const profile = this.userProfiles.get(userId);
    Object.assign(profile, updates, { last_updated: new Date() });
    
    logger.memory.update(userId, 'profile', { updatedFields: Object.keys(updates) });
    
    return profile;
  }

  getUserProfile(userId) {
    return this.userProfiles.get(userId) || null;
  }

  // Memory cleanup
  cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    let cleaned = 0;
    
    // Clean old conversations
    for (const [key, conversation] of this.conversations) {
      if (now - conversation.created.getTime() > maxAge) {
        this.conversations.delete(key);
        cleaned++;
      }
    }
    
    logger.info(`Memory cleanup completed`, { conversationsRemoved: cleaned });
    return cleaned;
  }

  // Get memory statistics
  getStats() {
    return {
      active_conversations: this.conversations.size,
      user_profiles: this.userProfiles.size,
      total_interactions: Array.from(this.conversations.values())
        .reduce((sum, conv) => sum + conv.interactions.length, 0),
      memory_usage: {
        conversations: `${JSON.stringify(Array.from(this.conversations.values())).length} chars`,
        profiles: `${JSON.stringify(Array.from(this.userProfiles.values())).length} chars`
      }
    };
  }

  // Export conversation for analysis
  exportConversation(userId, sessionId) {
    const conversation = this.getConversation(userId, sessionId);
    if (!conversation) return null;
    
    return {
      metadata: {
        userId,
        sessionId,
        created: conversation.created,
        duration: new Date() - conversation.created,
        interaction_count: conversation.interactions.length
      },
      context: conversation.context,
      interactions: conversation.interactions.map(interaction => ({
        timestamp: interaction.timestamp,
        type: interaction.type,
        user_input: interaction.user_input,
        ai_response_length: interaction.ai_response ? interaction.ai_response.length : 0,
        sentiment: interaction.sentiment || 'unknown'
      })),
      summary: conversation.summary
    };
  }
}

module.exports = new MemoryService();