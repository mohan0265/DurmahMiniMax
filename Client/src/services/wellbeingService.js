// Client/src/services/wellbeingService.js
import { supabase } from '../lib/supabase';

const MOOD_STORAGE_KEY = 'durmah_mood_history';

export class WellbeingService {
  // Store mood locally and in database if authenticated
  static async recordMood(userId, mood, context = {}) {
    const moodEntry = {
      mood,
      timestamp: new Date().toISOString(),
      context,
      user_id: userId
    };

    // Store locally for immediate access
    const localHistory = this.getLocalMoodHistory();
    localHistory.push(moodEntry);
    
    // Keep only last 30 entries locally
    if (localHistory.length > 30) {
      localHistory.splice(0, localHistory.length - 30);
    }
    
    localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(localHistory));

    // Store in Supabase if authenticated
    if (userId && supabase) {
      try {
        const { error } = await supabase
          .from('mood_logs')
          .insert([{
            user_id: userId,
            mood: mood,
            context: context,
            created_at: moodEntry.timestamp
          }]);
        
        if (error) {
          console.warn('Failed to save mood to database:', error);
        }
      } catch (error) {
        console.warn('Database mood logging failed:', error);
      }
    }

    return moodEntry;
  }

  // Get recent mood history
  static getLocalMoodHistory() {
    try {
      const history = localStorage.getItem(MOOD_STORAGE_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.warn('Failed to parse mood history:', error);
      return [];
    }
  }

  // Get recent mood trend
  static getMoodTrend(days = 7) {
    const history = this.getLocalMoodHistory();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recent = history.filter(entry => 
      new Date(entry.timestamp) > cutoff
    );

    if (recent.length === 0) return null;

    const moodValues = {
      'great': 5,
      'good': 4,
      'okay': 3,
      'stressed': 2,
      'overwhelmed': 1
    };

    const avg = recent.reduce((sum, entry) => 
      sum + (moodValues[entry.mood] || 3), 0
    ) / recent.length;

    return {
      average: avg,
      trend: this.calculateTrend(recent, moodValues),
      count: recent.length,
      latest: recent[recent.length - 1]
    };
  }

  // Calculate if mood is improving, declining, or stable
  static calculateTrend(entries, moodValues) {
    if (entries.length < 2) return 'stable';
    
    const half = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, half);
    const secondHalf = entries.slice(half);

    const firstAvg = firstHalf.reduce((sum, entry) => 
      sum + (moodValues[entry.mood] || 3), 0
    ) / firstHalf.length;

    const secondAvg = secondHalf.reduce((sum, entry) => 
      sum + (moodValues[entry.mood] || 3), 0
    ) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    
    if (diff > 0.3) return 'improving';
    if (diff < -0.3) return 'declining';
    return 'stable';
  }

  // Get personalized check-in message based on time and mood history
  static getCheckInMessage() {
    const hour = new Date().getHours();
    const trend = this.getMoodTrend();
    const lastEntry = trend?.latest;
    
    // Time-based base messages
    let baseMessage = '';
    if (hour < 6) {
      baseMessage = "You're up quite late! How are you feeling right now?";
    } else if (hour < 12) {
      baseMessage = "Good morning! How's your energy today?";
    } else if (hour < 17) {
      baseMessage = "Hope your day's going well! How are you feeling?";
    } else if (hour < 22) {
      baseMessage = "How has your day been treating you?";
    } else {
      baseMessage = "Evening check-in - how are you feeling tonight?";
    }

    // Adjust based on mood trend
    if (trend?.trend === 'declining' && trend.count > 3) {
      baseMessage = "I've noticed things might feel challenging lately. How are you doing right now? 💜";
    } else if (trend?.trend === 'improving') {
      baseMessage = "It seems like things have been looking up for you! How are you feeling today? ✨";
    } else if (lastEntry && lastEntry.mood === 'overwhelmed') {
      const hoursSince = (new Date() - new Date(lastEntry.timestamp)) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        baseMessage = "Earlier you mentioned feeling overwhelmed. How are things now? I'm here with you 💜";
      }
    }

    return baseMessage;
  }

  // Get empathetic response based on mood
  static getEmpathicResponse(mood, context = {}) {
    const responses = {
      'great': [
        "That's wonderful to hear! I love seeing you thrive ✨",
        "Your positive energy is amazing! What's been going especially well?",
        "It makes me so happy to hear you're feeling great! 💜"
      ],
      'good': [
        "I'm glad you're feeling good today! That's really nice to hear 😊",
        "Good days are precious - I'm happy you're having one!",
        "Sounds like you're in a positive space right now 🌟"
      ],
      'okay': [
        "Okay is perfectly valid - not every day needs to be extraordinary 💜",
        "Some days are just 'okay' days, and that's completely fine",
        "Thanks for being honest about how you're feeling. Okay is okay 🤗"
      ],
      'stressed': [
        "I hear that you're feeling stressed. That sounds really difficult 💜",
        "Stress can be so overwhelming. You're not alone in feeling this way",
        "I'm sorry you're dealing with stress right now. Want to talk about it?"
      ],
      'overwhelmed': [
        "Feeling overwhelmed is so hard. I'm really glad you trusted me with how you're feeling 💜",
        "When everything feels like too much, please know that I'm here with you",
        "Overwhelm is exhausting. You're being so brave by acknowledging it"
      ]
    };

    const moodResponses = responses[mood] || responses['okay'];
    const randomResponse = moodResponses[Math.floor(Math.random() * moodResponses.length)];

    // Add context-specific follow-ups
    let followUp = '';
    if (context.studyRelated) {
      if (mood === 'stressed' || mood === 'overwhelmed') {
        followUp = " Would it help to talk through your study concerns or maybe try some relaxation techniques?";
      }
    }

    return randomResponse + followUp;
  }

  // Check if it's time for a proactive check-in
  static shouldShowCheckIn() {
    const lastCheckIn = localStorage.getItem('durmah_last_checkin');
    const now = new Date();
    
    if (!lastCheckIn) return true;
    
    const lastCheckInDate = new Date(lastCheckIn);
    const hoursSince = (now - lastCheckInDate) / (1000 * 60 * 60);
    
    // Show check-in if it's been more than 4 hours, or if mood trend is concerning
    const trend = this.getMoodTrend(3); // Last 3 days
    const shouldCheckIn = hoursSince > 4 || 
                         (trend?.trend === 'declining' && hoursSince > 2);
    
    return shouldCheckIn;
  }

  // Mark check-in as completed
  static markCheckInCompleted() {
    localStorage.setItem('durmah_last_checkin', new Date().toISOString());
  }

  // Get study stress patterns
  static getStudyStressPattern() {
    const history = this.getLocalMoodHistory();
    const studyStress = history.filter(entry => 
      entry.context?.studyRelated && 
      (entry.mood === 'stressed' || entry.mood === 'overwhelmed')
    );

    if (studyStress.length < 3) return null;

    // Analyze time patterns
    const timePattern = studyStress.reduce((acc, entry) => {
      const hour = new Date(entry.timestamp).getHours();
      const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      acc[period] = (acc[period] || 0) + 1;
      return acc;
    }, {});

    const mostStressfulTime = Object.keys(timePattern).reduce((a, b) => 
      timePattern[a] > timePattern[b] ? a : b
    );

    return {
      mostStressfulTime,
      totalInstances: studyStress.length,
      suggestions: this.getStressSuggestions(mostStressfulTime)
    };
  }

  // Get personalized stress management suggestions
  static getStressSuggestions(timeOfDay) {
    const suggestions = {
      morning: [
        "Try starting your day with a few minutes of deep breathing before studying",
        "Consider a light morning walk or stretch before diving into challenging material",
        "Morning stress often comes from feeling behind - remember that every day is a fresh start"
      ],
      afternoon: [
        "Afternoon slumps are normal! Try taking a 10-minute break and having some water",
        "Consider breaking your study sessions into smaller, manageable chunks",
        "Your brain processes information differently throughout the day - this might be a good time for review rather than new material"
      ],
      evening: [
        "Evening stress can come from feeling unproductive during the day - be kind to yourself",
        "Try setting a cutoff time for intense study and switch to lighter review",
        "Evening is perfect for consolidating what you learned - your brain does amazing work while you sleep"
      ]
    };

    return suggestions[timeOfDay] || suggestions.afternoon;
  }
}

export default WellbeingService;