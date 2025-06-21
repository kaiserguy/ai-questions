# Automated Question Scheduling System - Design Document

## Overview
Implement a comprehensive scheduling system that allows users to:
- Configure automated questioning for personal questions
- Set custom frequencies (daily, weekly, monthly, custom intervals)
- Select specific AI models for each question
- Review and compare results over time with analytics

## Database Schema Design

### 1. Question Schedules Table
```sql
CREATE TABLE question_schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES personal_questions(id) ON DELETE CASCADE,
    frequency_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    frequency_value INTEGER, -- For custom intervals (e.g., every 3 days)
    frequency_unit VARCHAR(10), -- 'days', 'weeks', 'months' for custom
    selected_models TEXT[], -- Array of model names to query
    is_active BOOLEAN DEFAULT true,
    next_run_date TIMESTAMP,
    last_run_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Scheduled Executions Table (for tracking runs)
```sql
CREATE TABLE scheduled_executions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES question_schedules(id) ON DELETE CASCADE,
    execution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    models_executed TEXT[],
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    execution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    error_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Update Personal Questions Answers Table
```sql
-- Add schedule_id to track which answers came from scheduled runs
ALTER TABLE personal_question_answers 
ADD COLUMN schedule_id INTEGER REFERENCES question_schedules(id),
ADD COLUMN execution_id INTEGER REFERENCES scheduled_executions(id);
```

## API Endpoints Design

### Schedule Management
- `POST /api/personal-questions/:id/schedule` - Create/update schedule
- `GET /api/personal-questions/:id/schedule` - Get current schedule
- `DELETE /api/personal-questions/:id/schedule` - Remove schedule
- `GET /api/schedules` - List all user schedules
- `POST /api/schedules/:id/toggle` - Enable/disable schedule

### Execution Management
- `POST /api/schedules/execute-now/:id` - Manual execution
- `GET /api/schedules/:id/executions` - Get execution history
- `POST /api/schedules/execute-all` - Run all due schedules (cron job)

### Analytics & Comparison
- `GET /api/analytics/question/:id` - Get analytics for a question
- `GET /api/analytics/model-comparison/:id` - Compare models for a question
- `GET /api/analytics/trend-analysis/:id` - Trend analysis over time

## Frontend UI Components

### 1. Schedule Configuration Modal
- Frequency selector (Daily/Weekly/Monthly/Custom)
- AI model multi-select with checkboxes
- Preview of next execution dates
- Enable/disable toggle

### 2. Schedule Management Dashboard
- List of all scheduled questions
- Status indicators (active/inactive, next run, last run)
- Quick actions (edit, disable, run now, view results)
- Bulk operations

### 3. Analytics Dashboard
- Time-series charts showing response evolution
- Model comparison tables and charts
- Trend analysis with statistical insights
- Export capabilities

### 4. Question Card Enhancements
- Schedule status indicator
- Quick schedule setup button
- Last scheduled run info

## Implementation Phases

### Phase 1: Database Schema (Current)
- Create new tables for schedules and executions
- Update existing tables with foreign keys
- Database migration scripts

### Phase 2: Scheduling UI
- Schedule configuration modal
- Schedule management interface
- Integration with existing question cards

### Phase 3: Backend Scheduling System
- Cron job system for automated execution
- Queue management for concurrent AI requests
- Error handling and retry logic

### Phase 4: Analytics & Comparison
- Data visualization components
- Statistical analysis functions
- Export and reporting features

### Phase 5: Testing & Deployment
- End-to-end testing
- Performance optimization
- Production deployment

## Technical Considerations

### Scheduling Engine
- Use node-cron for scheduling
- Queue system for managing concurrent AI requests
- Graceful error handling and retry mechanisms

### Performance
- Batch processing for multiple models
- Rate limiting to respect AI API limits
- Efficient database queries with proper indexing

### User Experience
- Real-time status updates
- Progress indicators for long-running operations
- Intuitive scheduling interface

### Scalability
- Horizontal scaling considerations
- Database optimization for large datasets
- Caching strategies for analytics

This system will transform the application into a comprehensive AI monitoring platform that provides valuable insights into AI behavior patterns over time.

