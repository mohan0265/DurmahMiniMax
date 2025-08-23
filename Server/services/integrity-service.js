// Server/services/integrity-service.js - Academic integrity monitoring
const logger = require('../lib/logger');

class IntegrityService {
  constructor() {
    this.initialized = false;
    this.crisisKeywords = [
      'suicide', 'kill myself', 'end it all', 'not worth living',
      'hurt myself', 'self harm', 'want to die', 'hopeless',
      'worthless', 'give up', 'can\'t go on'
    ];
    
    this.ghostwritingPatterns = [
      /write.*essay.*for.*me/i,
      /do.*my.*assignment/i,
      /complete.*this.*coursework/i,
      /write.*my.*dissertation/i,
      /please.*write.*answer/i,
      /give.*me.*the.*answer.*to/i,
      /solve.*this.*problem.*for.*me/i
    ];
    
    this.academicViolationKeywords = [
      'cheat', 'plagiarize', 'copy answers', 'exam answers',
      'test answers', 'assignment solutions', 'homework answers'
    ];

    this.legalAdvicePatterns = [
      /should.*i.*sue/i,
      /is.*this.*legal/i,
      /what.*should.*i.*do.*legally/i,
      /can.*i.*get.*in.*trouble/i,
      /legal.*advice.*please/i,
      /represent.*me.*in.*court/i
    ];

    this.wellbeingTriggers = [
      'overwhelmed', 'stressed', 'anxious', 'panicking',
      'can\'t cope', 'breaking down', 'exhausted',
      'burned out', 'too much pressure'
    ];
  }

  init() {
    try {
      const enabled = process.env.FEATURE_ACADEMIC_INTEGRITY !== 'false';
      if (!enabled) {
        logger.warn('Academic integrity monitoring disabled');
        return false;
      }

      this.initialized = true;
      logger.info('Integrity service initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize integrity service:', error);
      return false;
    }
  }

  // Main content analysis function
  analyzeContent(content, context = {}) {
    if (!this.initialized || !content) {
      return {
        safe: true,
        flags: [],
        recommendations: []
      };
    }

    const flags = [];
    const recommendations = [];
    const contentLower = content.toLowerCase();

    // Crisis detection (highest priority)
    const crisisDetection = this.detectCrisis(contentLower);
    if (crisisDetection.detected) {
      flags.push({
        type: 'crisis',
        severity: 'critical',
        reason: 'Mental health crisis detected',
        keywords: crisisDetection.keywords,
        score: crisisDetection.score
      });
      
      recommendations.push({
        type: 'crisis_response',
        message: 'Immediate wellbeing support required',
        action: 'provide_crisis_resources'
      });
    }

    // Ghostwriting detection
    const ghostwritingDetection = this.detectGhostwriting(content);
    if (ghostwritingDetection.detected) {
      flags.push({
        type: 'ghostwriting',
        severity: 'high',
        reason: 'Request for academic work completion',
        patterns: ghostwritingDetection.patterns,
        score: ghostwritingDetection.score
      });
      
      recommendations.push({
        type: 'academic_integrity',
        message: 'Redirect to educational scaffolding',
        action: 'provide_learning_guidance'
      });
    }

    // Academic misconduct detection
    const misconductDetection = this.detectAcademicMisconduct(contentLower);
    if (misconductDetection.detected) {
      flags.push({
        type: 'academic_misconduct',
        severity: 'high',
        reason: 'Academic misconduct indicators',
        keywords: misconductDetection.keywords,
        score: misconductDetection.score
      });
      
      recommendations.push({
        type: 'integrity_reminder',
        message: 'Reinforce academic integrity principles',
        action: 'provide_integrity_guidance'
      });
    }

    // Legal advice detection
    const legalAdviceDetection = this.detectLegalAdviceRequest(content);
    if (legalAdviceDetection.detected) {
      flags.push({
        type: 'legal_advice',
        severity: 'medium',
        reason: 'Request for professional legal advice',
        patterns: legalAdviceDetection.patterns,
        score: legalAdviceDetection.score
      });
      
      recommendations.push({
        type: 'professional_boundary',
        message: 'Clarify educational vs professional advice',
        action: 'provide_boundary_reminder'
      });
    }

    // Wellbeing monitoring
    const wellbeingDetection = this.detectWellbeingConcerns(contentLower);
    if (wellbeingDetection.detected) {
      flags.push({
        type: 'wellbeing_concern',
        severity: 'medium',
        reason: 'Student wellbeing indicators',
        keywords: wellbeingDetection.keywords,
        score: wellbeingDetection.score
      });
      
      recommendations.push({
        type: 'wellbeing_support',
        message: 'Offer wellbeing support and resources',
        action: 'provide_wellbeing_guidance'
      });
    }

    const safe = flags.length === 0 || 
                 flags.every(flag => flag.severity === 'low' || flag.type === 'wellbeing_concern');

    return {
      safe,
      flags,
      recommendations,
      analysis: {
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
        analysisTime: new Date().toISOString(),
        context
      }
    };
  }

  // Crisis detection
  detectCrisis(content) {
    const keywords = [];
    let score = 0;

    for (const keyword of this.crisisKeywords) {
      if (content.includes(keyword)) {
        keywords.push(keyword);
        score += 1;
      }
    }

    // Additional pattern matching for crisis
    const crisisPatterns = [
      /no.*point.*in.*living/i,
      /life.*is.*meaningless/i,
      /everyone.*would.*be.*better.*without.*me/i,
      /thinking.*about.*ending.*it/i
    ];

    for (const pattern of crisisPatterns) {
      if (pattern.test(content)) {
        keywords.push('crisis_pattern');
        score += 2;
      }
    }

    return {
      detected: score >= 1,
      keywords,
      score,
      severity: score >= 3 ? 'critical' : score >= 1 ? 'high' : 'none'
    };
  }

  // Ghostwriting detection
  detectGhostwriting(content) {
    const patterns = [];
    let score = 0;

    for (const pattern of this.ghostwritingPatterns) {
      if (pattern.test(content)) {
        patterns.push(pattern.toString());
        score += 1;
      }
    }

    // Additional checks for direct requests
    const directRequests = [
      'write for me', 'do for me', 'complete for me',
      'give me the answer', 'solve for me'
    ];

    for (const request of directRequests) {
      if (content.toLowerCase().includes(request)) {
        patterns.push(request);
        score += 1;
      }
    }

    return {
      detected: score >= 1,
      patterns,
      score,
      severity: score >= 2 ? 'high' : 'medium'
    };
  }

  // Academic misconduct detection
  detectAcademicMisconduct(content) {
    const keywords = [];
    let score = 0;

    for (const keyword of this.academicViolationKeywords) {
      if (content.includes(keyword)) {
        keywords.push(keyword);
        score += 1;
      }
    }

    return {
      detected: score >= 1,
      keywords,
      score,
      severity: score >= 2 ? 'high' : 'medium'
    };
  }

  // Legal advice detection
  detectLegalAdviceRequest(content) {
    const patterns = [];
    let score = 0;

    for (const pattern of this.legalAdvicePatterns) {
      if (pattern.test(content)) {
        patterns.push(pattern.toString());
        score += 1;
      }
    }

    return {
      detected: score >= 1,
      patterns,
      score,
      severity: 'medium'
    };
  }

  // Wellbeing concerns detection
  detectWellbeingConcerns(content) {
    const keywords = [];
    let score = 0;

    for (const trigger of this.wellbeingTriggers) {
      if (content.includes(trigger)) {
        keywords.push(trigger);
        score += 1;
      }
    }

    return {
      detected: score >= 1,
      keywords,
      score,
      severity: score >= 3 ? 'medium' : 'low'
    };
  }

  // Generate appropriate AI response modifications
  generateResponseGuidance(analysisResult) {
    if (!analysisResult.flags.length) {
      return {
        proceed: true,
        modifications: []
      };
    }

    const modifications = [];
    let proceed = true;

    for (const flag of analysisResult.flags) {
      switch (flag.type) {
        case 'crisis':
          proceed = false;
          modifications.push({
            type: 'crisis_response',
            priority: 'critical',
            action: 'immediate_support',
            message: 'I\'m concerned about what you\'ve shared. Your wellbeing is the most important thing right now. Please reach out to someone who can provide immediate support.'
          });
          break;

        case 'ghostwriting':
          modifications.push({
            type: 'educational_redirect',
            priority: 'high',
            action: 'scaffolding',
            message: 'I\'m here to help you learn, not complete work for you. Let me guide you through understanding the concepts so you can tackle this yourself.'
          });
          break;

        case 'academic_misconduct':
          modifications.push({
            type: 'integrity_reminder',
            priority: 'high',
            action: 'educate',
            message: 'Academic integrity is fundamental to your legal education. Let me help you understand the proper approach to this challenge.'
          });
          break;

        case 'legal_advice':
          modifications.push({
            type: 'professional_boundary',
            priority: 'medium',
            action: 'clarify',
            message: 'I can help with legal education and concepts, but I cannot provide professional legal advice for real situations. For actual legal matters, consult a qualified solicitor.'
          });
          break;

        case 'wellbeing_concern':
          modifications.push({
            type: 'wellbeing_support',
            priority: 'medium',
            action: 'support',
            message: 'It sounds like you\'re going through a challenging time. Remember that struggling is normal, and there are resources available to help you.'
          });
          break;
      }
    }

    return {
      proceed,
      modifications,
      analysisResult
    };
  }

  // Generate OSCOLA citation guidance
  generateOSCOLAGuidance(citationType = 'general') {
    const guidance = {
      general: {
        message: 'Remember to follow OSCOLA citation standards',
        tips: [
          'Use footnotes for all legal sources',
          'Include pinpoint references for specific pages',
          'Use italics for case names and legislation',
          'Follow the standard OSCOLA formatting'
        ]
      },
      cases: {
        message: 'For case citations, follow this OSCOLA format:',
        example: 'Case Name [Year] Citation [para] (if applicable)',
        tips: [
          'Italicize case names',
          'Include year in square brackets',
          'Use paragraph numbers for recent cases',
          'Include court information if not clear from citation'
        ]
      },
      legislation: {
        message: 'For legislation citations, use this OSCOLA format:',
        example: 'Act Name Year, section/part',
        tips: [
          'Use short titles in italics',
          'Include specific sections or parts',
          'Use "s" for section, "ss" for sections',
          'Include subsection references as needed'
        ]
      }
    };

    return guidance[citationType] || guidance.general;
  }

  // Log integrity events
  logIntegrityEvent(userId, eventType, data) {
    if (!this.initialized) return;

    logger.integrity.flag(userId, eventType, data.severity || 'medium', {
      flags: data.flags?.length || 0,
      content_length: data.contentLength || 0,
      context: data.context || {}
    });
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.initialized,
      features: {
        crisis_detection: true,
        ghostwriting_detection: true,
        academic_misconduct: true,
        legal_advice_boundary: true,
        wellbeing_monitoring: true,
        oscola_guidance: true
      },
      patterns: {
        crisis_keywords: this.crisisKeywords.length,
        ghostwriting_patterns: this.ghostwritingPatterns.length,
        violation_keywords: this.academicViolationKeywords.length,
        legal_advice_patterns: this.legalAdvicePatterns.length,
        wellbeing_triggers: this.wellbeingTriggers.length
      }
    };
  }
}

// Export singleton instance
module.exports = new IntegrityService();