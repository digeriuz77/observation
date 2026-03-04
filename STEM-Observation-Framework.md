# STEM Observation App: Enhancement Framework

## Executive Summary

This document presents a comprehensive framework for transforming the current STEM Observation app into a production-ready inspection and coaching tool. The app addresses the needs of a 6-person observer team conducting baseline observations across 4 schools, with the goal of coaching 12 teachers over an 8-month period to bridge the theory-practice gap in STEM instruction through English.

---

## 1. Current State Assessment

### 1.1 Existing Strengths

The current implementation demonstrates a solid architectural foundation:

| Component | Status | Notes |
|-----------|--------|-------|
| **Tech Stack** | ✅ Solid | Next.js 16 + Supabase + React 19 + Tailwind CSS 4 |
| **5-Domain Framework** | ✅ Implemented | Danielson-inspired domains covering Content Planning, Formative Assessment, Instruction, Community/Routines, Language Environment |
| **Observer Selection** | ✅ Functional | 6 observers can select their name on app launch |
| **Text-Entry Only** | ✅ Aligned | Non-judgmental qualitative observation approach |
| **Real-time Sync** | ✅ Architecture Ready | Supabase integration for live data sharing |
| **AI Synthesis** | ✅ UI Ready | Sparkles button with thematic analysis display |

### 1.2 Identified Gaps

| Gap Area | Current State | Required Enhancement |
|----------|---------------|---------------------|
| **Teacher Management** | Free-text entry | Managed list of 12 teachers with school assignments |
| **School Management** | Free-text entry | Standardized list of 4 schools |
| **Observation Metadata** | Limited fields | Subject, lesson duration, class size, year group |
| **Filtering & Analytics** | Basic table | School, teacher, observer, date range filters |
| **Teacher Progress Tracking** | None | Individual teacher profiles with observation history |
| **AI Synthesis** | Mocked | Real Gemini API integration |
| **Configuration** | Hardcoded | Admin panel for managing observers, teachers, schools |
| **Measurement Framework** | None | Baseline/endline metrics with quantifiable indicators |
| **Export** | None | CSV/PDF export for reports |

---

## 2. Enhanced Data Model

### 2.1 Database Schema (Supabase)

```sql
-- Core tables for enhanced functionality

-- 1. Schools (4 schools)
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,  -- e.g., 'SCH001'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Teachers (12 teachers across 4 schools)
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id),
    employee_id TEXT,  -- Optional internal ID
    subject_specialty TEXT,  -- Maths, Science, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, school_id)
);

-- 3. Observers (6 team members)
CREATE TABLE observers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    initials TEXT NOT NULL,
    role TEXT DEFAULT 'observer',  -- observer, lead, admin
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Observations (main data table)
CREATE TABLE observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Metadata (Required)
    observer_id UUID REFERENCES observers(id),
    teacher_id UUID REFERENCES teachers(id),
    school_id UUID REFERENCES schools(id),
    observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    observation_time TIME,
    
    -- Lesson Context (Enhanced)
    subject TEXT NOT NULL,  -- Mathematics, Science, etc.
    topic TEXT,  -- Specific topic being taught
    year_group TEXT NOT NULL,  -- Year 5, Year 8, etc.
    lesson_duration_minutes INTEGER,
    class_size INTEGER,
    observation_type TEXT DEFAULT 'walkthrough',  -- walkthrough, formal, peer
    
    -- Domain Notes (5 domains)
    domain_1_notes TEXT,  -- Content Planning
    domain_2_notes TEXT,  -- Formative Assessment
    domain_3_notes TEXT,  -- Instruction
    domain_4_notes TEXT,  -- Community & Routines
    domain_5_notes TEXT,  -- Language Environment
    
    -- Synthesis Fields (AI-populated)
    coaching_notes TEXT,  -- Positive feedback
    identified_gaps TEXT,  -- AI-identified gaps
    recommended_focus TEXT,  -- AI coaching recommendations
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI Analysis Cache (for performance)
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_ids UUID[],  -- Array of observation IDs analyzed
    analysis_text TEXT NOT NULL,
    themes JSONB,  -- Extracted themes
    recommendations JSONB,
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Data Collection Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **Observer** | Select | Yes | Pre-defined list (6 observers) |
| **Teacher** | Select | Yes | From managed list (12 teachers) |
| **School** | Select | Yes | From managed list (4 schools) |
| **Date** | Date | Yes | Auto-populated, editable |
| **Subject** | Select | Yes | Maths, Science, Combined |
| **Topic** | Text | No | Specific lesson topic |
| **Year Group** | Select | Yes | Year 1-13 |
| **Lesson Duration** | Number | No | Minutes |
| **Class Size** | Number | No | Number of students |
| **Observation Type** | Select | Yes | Walkthrough, Formal, Peer |
| **Domain 1-5 Notes** | Textarea | Yes | Observation notes per domain |
| **Coaching Notes** | Textarea | Yes | Positive notes for teacher |

---

## 3. Feature Enhancements

### 3.1 Observer Management

**Current:** Hardcoded array in [`page.tsx:12`](src/app/page.tsx:12)
```typescript
const observers = ['Observer 1', 'Observer 2', 'Observer 3', 'Observer 4', 'Observer 5', 'Observer 6'];
```

**Enhanced:** Database-backed with admin configuration

```
User Flow:
1. App loads → Fetch observers from Supabase
2. Display as selection buttons (maintains current UX)
3. Admin can add/edit observers via settings panel
```

### 3.2 Teacher & School Management

**Current:** Free-text entry in [`ObservationForm.tsx:72-98`](src/app/components/ObservationForm.tsx:72-98)

**Enhanced:** Managed dropdowns with validation

```
Configuration Panel (Admin):
├── Schools Tab
│   ├── Add/Edit/Delete schools
│   └── View school statistics
├── Teachers Tab
│   ├── Add teacher (name, school assignment, subject)
│   ├── Edit teacher details
│   └── View teacher observation history
└── Observers Tab
    ├── Add/Edit observers
    └── Assign roles (observer/admin)
```

### 3.3 Enhanced Observation Form

Maintain the 5-domain structure but enhance with:

1. **Quick-Add Templates:** Pre-defined observation prompts per domain
2. **Word Count Indicator:** Encourage thorough notes (minimum 50 words/domain)
3. **Auto-Save Draft:** LocalStorage backup every 30 seconds
4. **Rich Text:** Basic formatting (bullets, bold) for clarity

### 3.4 Dashboard & Analytics

**Current:** Simple table view in [`Dashboard.tsx:92-123`](src/app/components/Dashboard.tsx:92-123)

**Enhanced:** Multi-dimensional analysis

```
Dashboard Features:
├── Summary Cards
│   ├── Total observations this month
│   ├── Teachers observed (X of 12)
│   ├── Schools covered (X of 4)
│   └── Observations per observer
├── Filters Panel
│   ├── Date range picker
│   ├── School multi-select
│   ├── Teacher multi-select
│   ├── Observer multi-select
│   └── Subject filter
├── Data Table
│   ├── Sortable columns
│   ├── Expandable rows (full observation details)
│   ├── Quick edit capability
│   └── Export to CSV
└── Visual Analytics (Future Phase)
    ├── Domain score trends
    ├── Teacher progress charts
    └── School comparison
```

### 3.5 AI Synthesis (Real Implementation)

**Current:** Mocked in [`Dashboard.tsx:30-46`](src/app/components/Dashboard.tsx:30-46)

**Enhanced:** Production AI integration

```typescript
// Proposed AI synthesis function
async function synthesizeObservations(observations: Observation[]) {
  const prompt = `
You are an educational consultant analyzing STEM teaching observations.
Analyze the following ${observations.length} observations from ${uniqueSchools} schools
involving ${uniqueTeachers} teachers.

OBSERVATIONS:
${observations.map(o => `
- School: ${o.school_name}, Teacher: ${o.teacher_name}, Subject: ${o.subject}
- Domain 1 (Content): ${o.domain_1_notes}
- Domain 2 (Assessment): ${o.domain_2_notes}
- Domain 3 (Instruction): ${o.domain_3_notes}
- Domain 4 (Community): ${o.domain_4_notes}
- Domain 5 (Language): ${o.domain_5_notes}
- Coaching Notes: ${o.coaching_notes}
`).join('\n')}

Based on these observations:
1. Identify 5-7 key themes emerging across the observations
2. Note specific gaps between PD training and observed practice
3. Provide actionable coaching recommendations for the upcoming cycle
4. Highlight school-specific patterns if evident

Format your response with clear headings and bullet points.
`;

  // Call Gemini API via Next.js API route
  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ observations, prompt })
  });
  
  return response.json();
}
```

### 3.6 Measurement Framework

For the 8-month coaching cycle, establish quantifiable indicators:

| Metric | Baseline (Month 1) | Mid-Point (Month 4) | Endline (Month 8) | Measurement Method |
|--------|-------------------|---------------------|-------------------|-------------------|
| **Domain 1: Content Planning** | % lessons with clear learning objectives | | | Observation checklist |
| **Domain 2: Formative Assessment** | Avg. wait time, checking for understanding frequency | | | Timed observation |
| **Domain 3: Instruction** | % teacher talk vs. student talk | | | Time sampling |
| **Domain 4: Language Environment** | Vocabulary instruction observed (Y/N) | | | Observation notes |
| **Domain 5: Disciplinary Language** | Student use of STEM vocabulary | | | Audio sampling |

---

## 4. Technical Implementation Plan

### 4.1 Phase 1: Data Infrastructure (Week 1-2)

1. **Supabase Setup**
   - Create database tables
   - Set up Row Level Security (RLS) policies
   - Seed initial data (4 schools, 12 teachers, 6 observers)

2. **Environment Configuration**
   - Update `.env.local` with real Supabase credentials
   - Add Gemini API key

### 4.2 Phase 2: Core Functionality (Week 3-4)

1. **Enhanced Forms**
   - Replace free-text with dropdowns
   - Add validation and auto-save

2. **Dashboard Updates**
   - Add filtering capabilities
   - Implement export functionality

### 4.3 Phase 3: AI Integration (Week 5-6)

1. **API Route**
   - Create `/api/analyze` endpoint
   - Integrate Gemini API

2. **Analysis Display**
   - Enhanced AI results presentation
   - Theme extraction and display

### 4.4 Phase 4: Admin & Configuration (Week 7-8)

1. **Admin Panel**
   - Manage schools, teachers, observers
   - View all data with export

2. **Testing & Training**
   - User acceptance testing
   - Team training session

---

## 5. Configuration & Deployment

### 5.1 Supabase Setup Script

```sql
-- Run this in Supabase SQL Editor to set up the database

-- Insert schools
INSERT INTO schools (name, code) VALUES 
  (' Maple Primary School', 'SCH001'),
  ('Oak Secondary School', 'SCH002'),
  ('Pine International School', 'SCH003'),
  ('Cedar STEM Academy', 'SCH004');

-- Insert observers
INSERT INTO observers (name, initials, role) VALUES 
  ('Sarah Mitchell', 'SM', 'lead'),
  ('James Chen', 'JC', 'observer'),
  ('Maria Garcia', 'MG', 'observer'),
  ('David Thompson', 'DT', 'observer'),
  ('Emily Watson', 'EW', 'observer'),
  ('Michael Brown', 'MB', 'observer');

-- Insert teachers (example - to be customized)
INSERT INTO teachers (name, school_id, subject_specialty)
SELECT 
  t.name,
  s.id,
  t.subject
FROM (
  VALUES 
    ('Teacher 1', 'SCH001', 'Mathematics'),
    ('Teacher 2', 'SCH001', 'Science'),
    ('Teacher 3', 'SCH002', 'Mathematics'),
    ('Teacher 4', 'SCH002', 'Science'),
    ('Teacher 5', 'SCH003', 'Mathematics'),
    ('Teacher 6', 'SCH003', 'Science'),
    ('Teacher 7', 'SCH004', 'Mathematics'),
    ('Teacher 8', 'SCH004', 'Science'),
    ('Teacher 9', 'SCH001', 'Mathematics'),
    ('Teacher 10', 'SCH002', 'Science'),
    ('Teacher 11', 'SCH003', 'Mathematics'),
    ('Teacher 12', 'SCH004', 'Science')
) t(name, code, subject)
JOIN schools s ON s.code = t.code;
```

### 5.2 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-actual-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 5.3 API Route for AI Analysis

```typescript
// src/app/api/analyze/route.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  const { observations, prompt } = await request.json();
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const result = await model.generateContent(prompt);
  const response = result();
  
  return.response.text Response.json({ analysis: response });
}
```

---

## 6. User Experience Summary

### 6.1 Observer Journey

```
┌─────────────────────────────────────────────────────────────────┐
│  APP LAUNCH                                                     │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────┐                                            │
│  │ Select Observer │ ◄── From pre-configured list (6 names)   │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                     │
│  │ New Observation │     │    Dashboard   │                     │
│  └────────┬────────┘     └────────┬────────┘                     │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────┐     ┌─────────────────┐                     │
│  │ Select Teacher │     │ View All Data   │                     │
│  │ Select School   │     │ Filter & Search │                     │
│  │ Fill Domains   │     │ AI Synthesis    │ ◄── Identify themes  │
│  │ Add Coaching   │     │ Export Reports  │                     │
│  └────────┬────────┘     └─────────────────┘                     │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  SYNC TO CLOUD  │ ◄── One-tap save to Supabase               │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Key UX Principles

1. **Single-Tap Sync:** One button to save and share observations
2. **Minimal Friction:** Maximum 3 taps to start new observation
3. **Non-Judgmental Design:** Text-only, no scoring/ratings
4. **Instant Collaboration:** Data available to all observers immediately
5. **AI-Assisted Synthesis:** One-tap thematic analysis

---

## 7. Recommendations

### 7.1 Immediate Actions

1. **Configure Supabase:** Set up the database with the schema above
2. **Seed Data:** Add 4 schools, 12 teachers, 6 observers
3. **Update Environment:** Add real API keys
4. **Test Sync:** Verify observations save to cloud
5. **Deploy:** Push to production (Vercel recommended)

### 7.2 Future Enhancements (Post-8-Month)

- Mobile app (iOS/Android)
- Offline mode with sync
- Video annotation integration
- Parent-teacher communication portal
- Integration with school MIS systems

---

## 8. Conclusion

This framework transforms the existing prototype into a production-ready inspection and coaching tool. The app will enable your team of 6 observers to:

- ✅ Capture baseline observations across 4 schools
- ✅ Track 12 teachers with individual profiles
- ✅ Store all data in a shared, real-time environment
- ✅ Generate AI-powered thematic analysis
- ✅ Measure progress over the 8-month coaching cycle
- ✅ Export data for external reporting

The architecture is designed for rapid deployment while maintaining flexibility for future enhancements.

---

*Document Version: 1.0*  
*Generated for: STEM Observation Team*  
*Framework: Next.js + Supabase + Gemini AI*
