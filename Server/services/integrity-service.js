// Server/services/integrity-service.js - Academic integrity and content analysis
const logger = require('../lib/logger');

class IntegrityService {
  constructor() {
    this.contentFlags = [
      'complete assignment',
      'write my essay',
      'do my homework',
      'answer key',
      'exam answers',
      'cheat',
      'plagiarism'
    ];
    
    this.oscolaTemplates = {
      case: {
        format: '[Name] v [Name] [Year] [Court] [Citation]',
        example: 'Donoghue v Stevenson [1932] AC 562 (HL)',
        description: 'Case citation format'
      },
      statute: {
        format: '[Act Title] [Year], s [section]',
        example: 'Human Rights Act 1998, s 3',
        description: 'Statute citation format'
      },
      journal: {
        format: '[Author], "[Title]" ([Year]) [Volume] [Journal] [Page]',
        example: 'H Collins, "The Decline of Privacy in Private Law" (2019) 42 J Legal Stud 25',
        description: 'Journal article citation format'
      },
      book: {
        format: '[Author], [Title] ([Publisher] [Year])',
        example: 'A Bradley and K Ewing, Constitutional and Administrative Law (16th edn, Pearson 2018)',
        description: 'Book citation format'
      }
    };
  }

  analyzeContent(content, context = {}) {
    const flags = [];
    const contentLower = content.toLowerCase();
    
    // Check for direct academic dishonesty requests
    for (const flag of this.contentFlags) {
      if (contentLower.includes(flag.toLowerCase())) {
        flags.push({
          type: 'academic_dishonesty',
          flag: flag,
          severity: 'high',
          message: 'Request appears to violate academic integrity policies'
        });
      }
    }
    
    // Check content length for potential policy violations
    if (content.length > 5000 && context.source === 'assignment_request') {
      flags.push({
        type: 'excessive_content',
        severity: 'medium',
        message: 'Large content blocks may indicate assignment copying'
      });
    }
    
    // Check for crisis indicators
    const crisisKeywords = [
      'suicidal', 'kill myself', 'end it all', 'can\'t go on',
      'self harm', 'hurt myself', 'depressed', 'hopeless'
    ];
    
    for (const keyword of crisisKeywords) {
      if (contentLower.includes(keyword)) {
        flags.push({
          type: 'mental_health_crisis',
          severity: 'critical',
          message: 'Content indicates potential mental health crisis'
        });
        break; // Only flag once for crisis
      }
    }
    
    const isSafe = !flags.some(flag => flag.severity === 'high' || flag.severity === 'critical');
    
    return {
      safe: isSafe,
      flags,
      recommendations: this.generateRecommendations(flags),
      analysis: {
        word_count: content.split(/\s+/).length,
        character_count: content.length,
        has_citations: this.detectCitations(content),
        academic_tone: this.assessAcademicTone(content)
      }
    };
  }

  detectCitations(content) {
    // Look for common citation patterns
    const citationPatterns = [
      /\[\d{4}\]/,  // Year in brackets
      /\(\d{4}\)/,  // Year in parentheses
      /\sv\s/,      // "v" for case citations
      /\d+\s+[A-Z]{2,}\s+\d+/, // Court citations
      /s\s*\d+/     // Section references
    ];
    
    return citationPatterns.some(pattern => pattern.test(content));
  }

  assessAcademicTone(content) {
    const academicIndicators = [
      'furthermore', 'however', 'therefore', 'moreover', 'consequently',
      'established', 'precedent', 'principle', 'authority', 'ratio',
      'obiter', 'judicial', 'statute', 'legislation', 'common law'
    ];
    
    const contentLower = content.toLowerCase();
    const foundIndicators = academicIndicators.filter(indicator => 
      contentLower.includes(indicator)
    );
    
    const score = Math.min(100, (foundIndicators.length / academicIndicators.length) * 100);
    
    return {
      score,
      level: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      indicators: foundIndicators
    };
  }

  generateRecommendations(flags) {
    const recommendations = [];
    
    if (flags.some(f => f.type === 'academic_dishonesty')) {
      recommendations.push({
        type: 'integrity_guidance',
        message: 'I can help you understand concepts and develop your own ideas, but cannot complete assignments for you.',
        resources: [
          'Durham University Academic Integrity Policy',
          'Study skills guidance',
          'Legal research methods'
        ]
      });
    }
    
    if (flags.some(f => f.type === 'mental_health_crisis')) {
      recommendations.push({
        type: 'crisis_support',
        message: 'I\'m concerned about your wellbeing. Please reach out to professional support.',
        resources: [
          'Samaritans: 116 123 (free, 24/7)',
          'Durham University Counselling Service: 0191 334 2200',
          'Crisis Text Line: Text SHOUT to 85258'
        ]
      });
    }
    
    return recommendations;
  }

  generateOSCOLAGuidance(citationType = 'general') {
    if (this.oscolaTemplates[citationType]) {
      return {
        type: citationType,
        ...this.oscolaTemplates[citationType],
        tips: [
          'Always italicize case names when possible',
          'Use square brackets for neutral citations',
          'Include pinpoint references for specific pages',
          'Check the most recent edition for books'
        ]
      };
    }
    
    // General OSCOLA guidance
    return {
      type: 'general',
      description: 'OSCOLA (Oxford University Standard for Citation of Legal Authorities) guidance',
      key_principles: [
        'Cite primary sources where possible',
        'Use footnotes, not in-text citations',
        'Provide full citations on first mention',
        'Use pinpoint references for specific points'
      ],
      common_types: Object.keys(this.oscolaTemplates),
      resources: [
        'OSCOLA Quick Reference Guide',
        'Durham Law School Citation Guide',
        'Legal databases for accurate citations'
      ]
    };
  }

  // Assistance level detection
  analyzeAssistanceLevel(request, context = {}) {
    const requestLower = request.toLowerCase();
    
    // High assistance (potentially problematic)
    const highAssistanceIndicators = [
      'write', 'complete', 'do my', 'answer', 'solve',
      'give me the', 'what should I write', 'full essay'
    ];
    
    // Medium assistance (guidance needed)
    const mediumAssistanceIndicators = [
      'how do I', 'help me understand', 'explain',
      'guide me', 'structure', 'approach'
    ];
    
    // Low assistance (information seeking)
    const lowAssistanceIndicators = [
      'what is', 'define', 'meaning of', 'history of',
      'background', 'overview', 'summary'
    ];
    
    if (highAssistanceIndicators.some(indicator => requestLower.includes(indicator))) {
      return {
        level: 'high',
        risk: 'academic_integrity',
        recommendation: 'Redirect to conceptual understanding and guidance',
        appropriate_response: 'I can help you understand the concepts, but you should develop and write your own response.'
      };
    }
    
    if (mediumAssistanceIndicators.some(indicator => requestLower.includes(indicator))) {
      return {
        level: 'medium',
        risk: 'moderate',
        recommendation: 'Provide structured guidance without direct answers',
        appropriate_response: 'I can guide you through the thinking process and key considerations.'
      };
    }
    
    return {
      level: 'low',
      risk: 'minimal',
      recommendation: 'Provide informational support',
      appropriate_response: 'I can provide background information and context to help your understanding.'
    };
  }

  // Provenance tracking for transparency
  createProvenanceRecord(interaction, userId = null) {
    return {
      id: `prov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      timestamp: new Date().toISOString(),
      interaction_type: interaction.type,
      content_analysis: interaction.analysis || {},
      assistance_level: interaction.assistance_level || {},
      ai_contribution: interaction.ai_response ? {
        type: 'guidance',
        length: interaction.ai_response.length,
        contains_direct_answers: this.containsDirectAnswers(interaction.ai_response)
      } : null,
      human_contribution: interaction.human_input ? {
        type: 'question',
        length: interaction.human_input.length,
        topic: interaction.topic || 'general'
      } : null,
      integrity_flags: interaction.flags || [],
      educational_value: this.assessEducationalValue(interaction)
    };
  }

  containsDirectAnswers(response) {
    const directAnswerPatterns = [
      /the answer is/i,
      /you should write/i,
      /the conclusion is/i,
      /in your essay, state/i
    ];
    
    return directAnswerPatterns.some(pattern => pattern.test(response));
  }

  assessEducationalValue(interaction) {
    let score = 0;
    const factors = [];
    
    if (interaction.encourages_thinking) {
      score += 25;
      factors.push('Encourages critical thinking');
    }
    
    if (interaction.provides_context) {
      score += 25;
      factors.push('Provides contextual information');
    }
    
    if (interaction.cites_sources) {
      score += 25;
      factors.push('References authoritative sources');
    }
    
    if (interaction.promotes_research) {
      score += 25;
      factors.push('Encourages further research');
    }
    
    return {
      score,
      level: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low',
      contributing_factors: factors
    };
  }
}

module.exports = new IntegrityService();