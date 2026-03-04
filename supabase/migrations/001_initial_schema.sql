-- STEM Observation App V2 - Complete Schema with RLS & M&E Support
-- Run this SQL in your Supabase Dashboard or via Supabase CLI

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the main observations table
CREATE TABLE observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    observer_id UUID, -- Optional: link to auth.users if using Supabase Auth
    teacher_name VARCHAR(255) NOT NULL,
    subject VARCHAR(100),
    grade_level VARCHAR(50),
    observed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Domain 1 & 2: Quick Checks
    objective_visible BOOLEAN DEFAULT FALSE,
    student_whisper_check VARCHAR(50), -- 'None', 'Task', or 'Concept'
    
    -- Timers (Stored in total seconds)
    total_duration_seconds INT DEFAULT 0,
    time_teacher_talking INT DEFAULT 0,
    time_student_talking INT DEFAULT 0,
    time_silence INT DEFAULT 0,
    avg_wait_time_seconds NUMERIC(5,2) DEFAULT 0.00,
    
    -- Teacher Question Tallies
    count_q_closed INT DEFAULT 0,
    count_q_open INT DEFAULT 0,
    count_q_probe INT DEFAULT 0,
    
    -- Student Response Tallies
    count_resp_short INT DEFAULT 0,
    count_resp_extended INT DEFAULT 0,
    count_resp_peer INT DEFAULT 0,
    
    -- Environment & Language
    count_code_switching INT DEFAULT 0,
    
    -- Qualitative Data
    formative_methods TEXT[], -- Array of strings e.g., ['Hands Up', 'Turn & Talk']
    verbatim_quotes TEXT,
    
    -- M&E Grouping Categories
    department VARCHAR(100), -- e.g., 'Science', 'Math', 'ICT'
    school_name VARCHAR(255), -- For multi-school support
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SECURITY: Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for offline-first app)
CREATE POLICY "Users can insert observations" 
ON observations FOR INSERT 
WITH CHECK (true);

-- Policy: Anyone can view (for dashboard)
CREATE POLICY "Users can view observations" 
ON observations FOR SELECT 
USING (true);

-- ==========================================
-- Create Aggregated View for Stakeholders
-- ==========================================
CREATE OR REPLACE VIEW stakeholder_summary AS
SELECT 
    department,
    school_name,
    COUNT(*) as total_observations,
    ROUND(AVG(time_teacher_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_teacher_talk_pct,
    ROUND(AVG(time_student_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_student_talk_pct,
    ROUND(AVG(time_silence / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_silence_pct,
    SUM(count_q_closed) as total_closed_questions,
    SUM(count_q_open) as total_open_questions,
    SUM(count_q_probe) as total_probe_questions,
    ROUND(AVG(avg_wait_time_seconds), 1) as schoolwide_avg_wait_time,
    ROUND((COUNT(CASE WHEN objective_visible = TRUE THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as pct_objective_visible,
    COUNT(CASE WHEN student_whisper_check = 'Concept' THEN 1 END) as students_explained_concept,
    COUNT(CASE WHEN student_whisper_check = 'Task' THEN 1 END) as students_explained_task,
    COUNT(CASE WHEN student_whisper_check = 'None' THEN 1 END) as students_could_not_explain
FROM observations
WHERE department IS NOT NULL
GROUP BY department, school_name;

-- Create view for teacher-level summary (for lead coach)
CREATE OR REPLACE VIEW teacher_summary AS
SELECT 
    teacher_name,
    department,
    school_name,
    COUNT(*) as total_observations,
    ROUND(AVG(time_teacher_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_teacher_talk_pct,
    ROUND(AVG(time_student_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_student_talk_pct,
    SUM(count_q_closed) as total_closed_questions,
    SUM(count_q_open) as total_open_questions,
    ROUND(AVG(avg_wait_time_seconds), 1) as avg_wait_time,
    COUNT(CASE WHEN objective_visible = TRUE THEN 1 END) as objectives_visible_count
FROM observations
GROUP BY teacher_name, department, school_name;

-- Create view for overall summary
CREATE OR REPLACE VIEW overall_summary AS
SELECT 
    COUNT(*) as total_observations,
    SUM(total_duration_seconds) / 60 as total_minutes_observed,
    ROUND(AVG(time_teacher_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_teacher_talk_pct,
    ROUND(AVG(time_student_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_student_talk_pct,
    ROUND(AVG(time_silence / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_silence_pct,
    SUM(count_q_closed) as total_closed_questions,
    SUM(count_q_open) as total_open_questions,
    SUM(count_q_probe) as total_probe_questions,
    ROUND(AVG(avg_wait_time_seconds), 1) as overall_avg_wait_time,
    ROUND((COUNT(CASE WHEN objective_visible = TRUE THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as pct_objective_visible,
    COUNT(DISTINCT teacher_name) as unique_teachers_observed,
    COUNT(DISTINCT department) as departments_represented
FROM observations;

-- Create indexes for common query patterns
CREATE INDEX idx_observations_teacher_name ON observations(teacher_name);
CREATE INDEX idx_observations_subject ON observations(subject);
CREATE INDEX idx_observations_grade_level ON observations(grade_level);
CREATE INDEX idx_observations_department ON observations(department);
CREATE INDEX idx_observations_school_name ON observations(school_name);
CREATE INDEX idx_observations_observed_at ON observations(observed_at DESC);
