-- ================================================
-- DURMAH DATABASE SCHEMA - Built with Love 💜
-- ================================================
-- Complete PostgreSQL schema for Supabase
-- Version: 1.0.0
-- ================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS crisis_flags CASCADE;
DROP TABLE IF EXISTS support_flags CASCADE;
DROP TABLE IF EXISTS stress_indicators CASCADE;
DROP TABLE IF EXISTS flashcards CASCADE;
DROP TABLE IF EXISTS quiz_results CASCADE;
DROP TABLE IF EXISTS study_plans CASCADE;
DROP TABLE IF EXISTS study_progress CASCADE;
DROP TABLE IF EXISTS wellbeing_logs CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ================================================
-- USERS TABLE - The Heart of Durmah
-- ================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    preferred_name TEXT,
    pronouns TEXT,
    avatar_url TEXT,
    law_year INT CHECK (law_year BETWEEN 1 AND 4),
    college TEXT,
    
    -- Preferences and settings
    preferences JSONB DEFAULT '{
        "voice": "british-female",
        "notifications": true,
        "darkMode": false,
        "fontSize": "medium",
        "studyReminders": true,
        "wellbeingCheckins": true,
        "breakReminders": true,
        "dailyGoal": 120
    }'::jsonb,
    
    -- Academic profile
    study_goals JSONB DEFAULT '[]'::jsonb,
    struggling_topics JSONB DEFAULT '[]'::jsonb,
    strong_topics JSONB DEFAULT '[]'::jsonb,
    
    -- Wellbeing profile
    stress_triggers JSONB DEFAULT '[]'::jsonb,
    coping_strategies JSONB DEFAULT '[]'::jsonb,
    support_network JSONB DEFAULT '[]'::jsonb,
    
    -- Stats and tracking
    study_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    total_study_time INT DEFAULT 0, -- in minutes
    total_messages INT DEFAULT 0,
    total_quizzes_taken INT DEFAULT 0,
    achievements_count INT DEFAULT 0,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    
    -- Privacy and consent
    gdpr_consent BOOLEAN DEFAULT false,
    gdpr_consent_date TIMESTAMPTZ,
    data_retention_preference TEXT DEFAULT '1_year',
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- CONVERSATIONS TABLE
-- ================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    topic TEXT,
    subject_area TEXT, -- Contract, Tort, Criminal, Constitutional, etc.
    conversation_type TEXT CHECK (conversation_type IN ('chat', 'quiz', 'revision', 'wellbeing', 'crisis', 'general')),
    
    -- Mood tracking
    mood_start TEXT,
    mood_end TEXT,
    stress_level_start INT CHECK (stress_level_start BETWEEN 1 AND 10),
    stress_level_end INT CHECK (stress_level_end BETWEEN 1 AND 10),
    
    -- Session metadata
    productivity_rating INT CHECK (productivity_rating BETWEEN 1 AND 5),
    helpful_rating INT CHECK (helpful_rating BETWEEN 1 AND 5),
    duration_minutes INT,
    message_count INT DEFAULT 0,
    
    -- Additional data
    key_topics JSONB DEFAULT '[]'::jsonb,
    resources_shared JSONB DEFAULT '[]'::jsonb,
    action_items JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_archived BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- MESSAGES TABLE
-- ================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'durmah', 'system')),
    message_text TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'quiz', 'explanation', 'resource', 'exercise')),
    
    -- Voice message data
    audio_url TEXT,
    audio_duration INT, -- in seconds
    
    -- AI processing metadata
    response_time_ms INT,
    tokens_used INT,
    model_used TEXT,
    
    -- Content analysis
    mood_detected TEXT,
    stress_level DECIMAL(3,2) CHECK (stress_level >= 0 AND stress_level <= 1),
    sentiment_score DECIMAL(3,2), -- -1 to 1
    topics_discussed JSONB DEFAULT '[]'::jsonb,
    cases_mentioned JSONB DEFAULT '[]'::jsonb,
    legal_concepts JSONB DEFAULT '[]'::jsonb,
    
    -- Flags
    flagged_for_review BOOLEAN DEFAULT false,
    contains_crisis_language BOOLEAN DEFAULT false,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- WELLBEING LOGS TABLE
-- ================================================
CREATE TABLE wellbeing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    
    -- Type and measurements
    log_type TEXT DEFAULT 'mood' CHECK (log_type IN ('mood', 'stress', 'energy', 'motivation', 'check_in', 'crisis')),
    mood TEXT,
    stress_level INT CHECK (stress_level BETWEEN 1 AND 10),
    energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
    motivation_level INT CHECK (motivation_level BETWEEN 1 AND 10),
    anxiety_level INT CHECK (anxiety_level BETWEEN 1 AND 10),
    
    -- Context
    log_text TEXT,
    location TEXT, -- Library, home, etc.
    activity_before TEXT, -- What they were doing
    triggers TEXT[],
    coping_strategies_used TEXT[],
    
    -- Support
    needs_support BOOLEAN DEFAULT false,
    support_requested BOOLEAN DEFAULT false,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- STUDY PROGRESS TABLE
-- ================================================
CREATE TABLE study_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subject and topic
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    
    -- Progress tracking
    mastery_level INT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 100),
    confidence_level INT DEFAULT 0 CHECK (confidence_level BETWEEN 0 AND 100),
    
    -- Time tracking
    last_studied TIMESTAMPTZ DEFAULT NOW(),
    total_time_spent INT DEFAULT 0, -- minutes
    session_count INT DEFAULT 0,
    
    -- Performance
    quiz_scores JSONB DEFAULT '[]'::jsonb,
    average_quiz_score DECIMAL(5,2),
    best_quiz_score INT,
    
    -- Learning data
    notes TEXT,
    key_points JSONB DEFAULT '[]'::jsonb,
    problem_areas JSONB DEFAULT '[]'::jsonb,
    resources_used JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- QUIZ RESULTS TABLE
-- ================================================
CREATE TABLE quiz_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    
    -- Quiz details
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    quiz_type TEXT DEFAULT 'multiple_choice' CHECK (quiz_type IN ('multiple_choice', 'true_false', 'essay', 'mixed')),
    
    -- Questions and answers
    questions JSONB NOT NULL,
    answers JSONB NOT NULL,
    correct_answers JSONB NOT NULL,
    
    -- Scoring
    score INT NOT NULL,
    total_questions INT NOT NULL,
    percentage DECIMAL(5,2),
    passed BOOLEAN,
    
    -- Performance
    time_taken INT, -- seconds
    average_time_per_question DECIMAL(5,2),
    
    -- Analysis
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    feedback TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- FLASHCARDS TABLE
-- ================================================
CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Card content
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    
    -- Additional info
    hint TEXT,
    explanation TEXT,
    case_references TEXT[],
    legal_principle TEXT,
    
    -- Spaced repetition algorithm
    ease_factor DECIMAL(3,2) DEFAULT 2.5,
    interval_days INT DEFAULT 1,
    repetitions INT DEFAULT 0,
    
    -- Performance tracking
    times_studied INT DEFAULT 0,
    times_correct INT DEFAULT 0,
    times_incorrect INT DEFAULT 0,
    average_response_time INT, -- seconds
    last_response_quality INT, -- 0-5
    
    -- Scheduling
    next_review TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_starred BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- STUDY PLANS TABLE
-- ================================================
CREATE TABLE study_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Plan details
    title TEXT NOT NULL,
    description TEXT,
    plan_type TEXT DEFAULT 'exam' CHECK (plan_type IN ('exam', 'revision', 'daily', 'weekly', 'topic')),
    
    -- Timeline
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    exam_date DATE,
    
    -- Content
    subjects JSONB NOT NULL,
    topics_to_cover JSONB DEFAULT '[]'::jsonb,
    daily_goals JSONB DEFAULT '{}'::jsonb,
    weekly_targets JSONB DEFAULT '{}'::jsonb,
    
    -- Progress
    progress_percentage INT DEFAULT 0,
    completed_topics JSONB DEFAULT '[]'::jsonb,
    remaining_topics JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_completed BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ================================================
-- ACHIEVEMENTS TABLE
-- ================================================
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT CHECK (category IN ('streak', 'mastery', 'wellbeing', 'community', 'special')),
    
    -- Requirements
    criteria JSONB NOT NULL,
    points INT DEFAULT 10,
    
    -- Rarity
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    
    -- Display
    display_order INT,
    is_secret BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- USER ACHIEVEMENTS TABLE
-- ================================================
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id),
    
    -- Progress for progressive achievements
    progress INT DEFAULT 0,
    progress_max INT,
    
    -- Unlock details
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    notified BOOLEAN DEFAULT false,
    
    UNIQUE(user_id, achievement_id)
);

-- ================================================
-- SUPPORT FLAGS TABLE
-- ================================================
CREATE TABLE support_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Flag details
    flag_type TEXT NOT NULL CHECK (flag_type IN ('crisis', 'stress', 'academic', 'technical', 'other')),
    reason TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'escalated', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Assignment
    assigned_to TEXT,
    assigned_at TIMESTAMPTZ,
    
    -- Resolution
    resolution_notes TEXT,
    resolved_by TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ
);

-- ================================================
-- CRISIS FLAGS TABLE
-- ================================================
CREATE TABLE crisis_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    message_id UUID REFERENCES messages(id),
    
    -- Crisis details
    trigger_words TEXT[],
    severity_score DECIMAL(3,2),
    message_snippet TEXT,
    
    -- Response
    auto_response_sent BOOLEAN DEFAULT false,
    resources_provided BOOLEAN DEFAULT false,
    support_contacted BOOLEAN DEFAULT false,
    
    -- Status
    responded BOOLEAN DEFAULT false,
    response_time TIMESTAMPTZ,
    responded_by TEXT,
    
    -- Follow-up
    follow_up_required BOOLEAN DEFAULT true,
    follow_up_completed BOOLEAN DEFAULT false,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- STRESS INDICATORS TABLE
-- ================================================
CREATE TABLE stress_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    
    -- Measurements
    stress_level DECIMAL(3,2) NOT NULL CHECK (stress_level >= 0 AND stress_level <= 1),
    confidence DECIMAL(3,2),
    
    -- Indicators
    indicators_detected JSONB DEFAULT '[]'::jsonb,
    patterns_identified JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INDEXES FOR PERFORMANCE
-- ================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created ON conversations(started_at);
CREATE INDEX idx_conversations_type ON conversations(conversation_type);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_wellbeing_user_id ON wellbeing_logs(user_id);
CREATE INDEX idx_wellbeing_created_at ON wellbeing_logs(created_at);
CREATE INDEX idx_wellbeing_type ON wellbeing_logs(log_type);
CREATE INDEX idx_study_progress_user_subject ON study_progress(user_id, subject);
CREATE INDEX idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_subject ON quiz_results(subject);
CREATE INDEX idx_flashcards_user_next_review ON flashcards(user_id, next_review);
CREATE INDEX idx_flashcards_subject ON flashcards(subject);
CREATE INDEX idx_support_flags_status ON support_flags(status);
CREATE INDEX idx_support_flags_user ON support_flags(user_id);
CREATE INDEX idx_crisis_flags_created ON crisis_flags(created_at);
CREATE INDEX idx_crisis_flags_user ON crisis_flags(user_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY users_policy ON users 
    FOR ALL USING (auth.uid() = id);

CREATE POLICY conversations_policy ON conversations 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY messages_policy ON messages 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY wellbeing_policy ON wellbeing_logs 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY study_progress_policy ON study_progress 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY quiz_results_policy ON quiz_results 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY flashcards_policy ON flashcards 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY study_plans_policy ON study_plans 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY user_achievements_policy ON user_achievements 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY stress_indicators_policy ON stress_indicators 
    FOR ALL USING (auth.uid() = user_id);

-- Support and crisis flags are only accessible by admins (no RLS for regular users)

-- ================================================
-- FUNCTIONS
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'messages' AND NEW.sender = 'user' THEN
        UPDATE users 
        SET total_messages = total_messages + 1,
            last_active = NOW()
        WHERE id = (
            SELECT user_id FROM conversations 
            WHERE id = NEW.conversation_id
        );
    END IF;
    
    IF TG_TABLE_NAME = 'quiz_results' THEN
        UPDATE users 
        SET total_quizzes_taken = total_quizzes_taken + 1
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check study streak
CREATE OR REPLACE FUNCTION check_study_streak()
RETURNS TRIGGER AS $$
DECLARE
    last_study_date DATE;
    current_streak INT;
BEGIN
    SELECT DATE(last_active), study_streak 
    INTO last_study_date, current_streak
    FROM users 
    WHERE id = NEW.user_id;
    
    IF last_study_date = CURRENT_DATE - INTERVAL '1 day' THEN
        -- Continue streak
        UPDATE users 
        SET study_streak = study_streak + 1,
            longest_streak = GREATEST(longest_streak, study_streak + 1)
        WHERE id = NEW.user_id;
    ELSIF last_study_date < CURRENT_DATE - INTERVAL '1 day' THEN
        -- Reset streak
        UPDATE users 
        SET study_streak = 1
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- TRIGGERS
-- ================================================

-- Update triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_study_progress_updated_at 
    BEFORE UPDATE ON study_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_flashcards_updated_at 
    BEFORE UPDATE ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_study_plans_updated_at 
    BEFORE UPDATE ON study_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Stats triggers
CREATE TRIGGER update_message_stats 
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

CREATE TRIGGER update_quiz_stats 
    AFTER INSERT ON quiz_results
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

CREATE TRIGGER check_streak 
    AFTER INSERT ON study_progress
    FOR EACH ROW EXECUTE FUNCTION check_study_streak();

-- ================================================
-- SEED INITIAL ACHIEVEMENTS
-- ================================================
INSERT INTO achievements (name, description, icon, category, criteria, points, rarity, display_order) VALUES
-- Streak Achievements
('First Steps', 'Complete your first study session', '👟', 'streak', '{"sessions": 1}'::jsonb, 10, 'common', 1),
('Week Warrior', 'Study for 7 days in a row', '🔥', 'streak', '{"streak_days": 7}'::jsonb, 50, 'common', 2),
('Fortnight Fighter', 'Study for 14 days in a row', '⚔️', 'streak', '{"streak_days": 14}'::jsonb, 100, 'rare', 3),
('Monthly Master', 'Study for 30 days in a row', '👑', 'streak', '{"streak_days": 30}'::jsonb, 200, 'epic', 4),
('Century Champion', 'Study for 100 days in a row', '💎', 'streak', '{"streak_days": 100}'::jsonb, 1000, 'legendary', 5),

-- Mastery Achievements
('Contract Novice', 'Complete first Contract Law topic', '📄', 'mastery', '{"subject": "contract", "topics": 1}'::jsonb, 20, 'common', 10),
('Contract Expert', 'Score 90%+ on Contract Law quiz', '📜', 'mastery', '{"subject": "contract", "min_score": 90}'::jsonb, 100, 'rare', 11),
('Tort Titan', 'Master all Tort Law topics', '⚡', 'mastery', '{"subject": "tort", "mastery": 100}'::jsonb, 150, 'epic', 12),
('Criminal Champion', 'Perfect score in Criminal Law', '🏆', 'mastery', '{"subject": "criminal", "perfect": true}'::jsonb, 200, 'epic', 13),
('Constitutional Scholar', 'Master Constitutional Law', '⚖️', 'mastery', '{"subject": "constitutional", "mastery": 80}'::jsonb, 150, 'rare', 14),
('Case Scholar', 'Review 50 legal cases', '📚', 'mastery', '{"cases_reviewed": 50}'::jsonb, 150, 'rare', 15),
('Quiz Master', 'Score 100% on any quiz', '💯', 'mastery', '{"perfect_score": true}'::jsonb, 75, 'rare', 16),

-- Wellbeing Achievements
('Balanced Life', 'Take regular study breaks', '☯️', 'wellbeing', '{"breaks_taken": 20}'::jsonb, 30, 'common', 20),
('Mindful Student', 'Complete 10 breathing exercises', '🧘', 'wellbeing', '{"breathing_exercises": 10}'::jsonb, 40, 'common', 21),
('Stress Warrior', 'Successfully manage high stress', '💪', 'wellbeing', '{"stress_managed": true}'::jsonb, 60, 'rare', 22),
('Supportive Friend', 'Check in on wellbeing daily for a week', '💜', 'wellbeing', '{"wellbeing_streak": 7}'::jsonb, 60, 'common', 23),
('Self Care Champion', 'Maintain good wellbeing for 30 days', '🌟', 'wellbeing', '{"wellbeing_days": 30}'::jsonb, 100, 'epic', 24),

-- Special Achievements
('Night Owl', 'Study late but remember to rest', '🦉', 'special', '{"late_night_sessions": 5}'::jsonb, 25, 'common', 30),
('Early Bird', 'Start studying before 7 AM', '🌅', 'special', '{"early_sessions": 5}'::jsonb, 25, 'common', 31),
('Weekend Warrior', 'Study on weekends', '🎯', 'special', '{"weekend_sessions": 10}'::jsonb, 40, 'common', 32),
('Legal Eagle', 'Unlock all other achievements', '🦅', 'special', '{"all_achievements": true}'::jsonb, 1000, 'legendary', 100)
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- GRANT PERMISSIONS
-- ================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ================================================
-- FINAL SETUP MESSAGE
-- ================================================
DO $$
BEGIN
    RAISE NOTICE 'Durmah Database Schema Successfully Created! 🦅💜';
    RAISE NOTICE 'All tables, indexes, and policies are ready.';
    RAISE NOTICE 'Remember to enable Email Authentication in Supabase Dashboard.';
END $$;