-- Create mood_logs table for wellbeing tracking
CREATE TABLE IF NOT EXISTS mood_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'stressed', 'overwhelmed')),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_id ON mood_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_logs_created_at ON mood_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_mood ON mood_logs(user_id, mood);

-- Add RLS policies
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own mood logs
CREATE POLICY "Users can view their own mood logs" 
ON mood_logs FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own mood logs
CREATE POLICY "Users can insert their own mood logs" 
ON mood_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own mood logs
CREATE POLICY "Users can update their own mood logs" 
ON mood_logs FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_mood_logs_updated_at 
BEFORE UPDATE ON mood_logs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON mood_logs TO authenticated;
GRANT ALL ON mood_logs TO service_role;