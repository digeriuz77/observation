-- Fix schema mismatches for STEM Observation App
-- Run this after 001_initial_schema.sql

-- Add missing columns to observations table
ALTER TABLE observations 
ADD COLUMN IF NOT EXISTS objective_concept TEXT,
ADD COLUMN IF NOT EXISTS formative_methods_count JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS observer_name VARCHAR(100);

-- Note: We're adding observer_name as a text field since we're not using Supabase Auth
-- If using Supabase Auth in future, link to auth.users(id) via observer_id UUID

-- Drop the old formative_methods array column if it exists and is not needed
-- (Keeping it for backward compatibility, new data goes into formative_methods_count)

-- Update the stakeholder_summary view to include observer tracking
DROP VIEW IF EXISTS stakeholder_summary;
CREATE OR REPLACE VIEW stakeholder_summary AS
SELECT 
    school_name,
    COUNT(*) as total_observations,
    COUNT(DISTINCT observer_name) as unique_observers,
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
GROUP BY school_name;

-- Update teacher_summary view
DROP VIEW IF EXISTS teacher_summary;
CREATE OR REPLACE VIEW teacher_summary AS
SELECT 
    teacher_name,
    school_name,
    COUNT(*) as total_observations,
    COUNT(DISTINCT observer_name) as unique_observers,
    ROUND(AVG(time_teacher_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_teacher_talk_pct,
    ROUND(AVG(time_student_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_student_talk_pct,
    SUM(count_q_closed) as total_closed_questions,
    SUM(count_q_open) as total_open_questions,
    ROUND(AVG(avg_wait_time_seconds), 1) as avg_wait_time,
    COUNT(CASE WHEN objective_visible = TRUE THEN 1 END) as objectives_visible_count
FROM observations
GROUP BY teacher_name, school_name;

-- Create view for observer summary (new)
CREATE OR REPLACE VIEW observer_summary AS
SELECT 
    observer_name,
    school_name,
    COUNT(*) as total_observations,
    COUNT(DISTINCT teacher_name) as unique_teachers_observed,
    SUM(total_duration_seconds) / 60 as total_minutes_observed,
    ROUND(AVG(time_teacher_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_teacher_talk_pct,
    ROUND(AVG(time_student_talking / NULLIF(total_duration_seconds, 0) * 100), 1) as avg_student_talk_pct
FROM observations
WHERE observer_name IS NOT NULL
GROUP BY observer_name, school_name;
