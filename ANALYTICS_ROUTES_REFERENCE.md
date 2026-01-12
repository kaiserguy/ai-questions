# Analytics Routes Reference (Issue #32)

This document provides a reference for implementing analytics endpoints (Issue #32) based on the legacy `core/hosted-index.cjs` file.

## Overview

The legacy file contains 5 analytics endpoints that need to be migrated to the production architecture:

1. `/api/analytics/question/:id` - Question-specific analytics
2. `/api/analytics/model-comparison/:id` - Compare model responses
3. `/api/analytics/trend-analysis/:id` - Analyze trends over time
4. `/api/analytics/dashboard` - Overall dashboard data
5. `/api/analytics/export-csv/:id` - Export data as CSV

## Endpoint Details

### 1. GET /api/analytics/question/:id

**Purpose**: Get analytics for a specific question  
**Auth**: Required  
**Parameters**: `id` (question ID)  
**Response**: JSON with analytics data

**Data Returned**:
- Total answers count
- Answers by model (grouped)
- Answers by date (grouped)
- Average confidence scores
- Model usage statistics

**Database Queries**:
- Get all answers for question
- Group by model name
- Group by date
- Calculate aggregates

**Implementation Location**: `core/routes.js` (add after existing routes)

### 2. GET /api/analytics/model-comparison/:id

**Purpose**: Compare responses from different models for a question  
**Auth**: Required  
**Parameters**: `id` (question ID)  
**Response**: JSON with model comparison data

**Data Returned**:
- Answers grouped by model
- Response times by model
- Confidence scores by model
- Answer length statistics
- Model availability

**Implementation Location**: `core/routes.js`

### 3. GET /api/analytics/trend-analysis/:id

**Purpose**: Analyze trends for a question over time  
**Auth**: Required  
**Parameters**: `id` (question ID)  
**Response**: JSON with trend data

**Data Returned**:
- Answers over time (time series)
- Model usage trends
- Confidence score trends
- Response time trends

**Implementation Location**: `core/routes.js`

### 4. GET /api/analytics/dashboard

**Purpose**: Get overall dashboard analytics  
**Auth**: Required  
**Response**: JSON with dashboard data

**Data Returned**:
- Total questions count
- Total answers count
- Most active questions
- Model usage statistics
- Recent activity
- User statistics (if applicable)

**Implementation Location**: `core/routes.js`

### 5. GET /api/analytics/export-csv/:id

**Purpose**: Export question analytics as CSV  
**Auth**: Required  
**Parameters**: `id` (question ID)  
**Response**: CSV file download

**Data Format**:
```csv
Date,Model,Answer,Confidence,Response Time
2026-01-11,gpt-4,Answer text,0.95,1.2s
```

**Implementation Location**: `core/routes.js`

## Database Methods Needed

Add to `core/pg-db.js`:

```javascript
async getQuestionAnalytics(questionId) {
    // Get all answers for question with aggregations
}

async getModelComparison(questionId) {
    // Get answers grouped by model
}

async getTrendAnalysis(questionId, timeRange) {
    // Get time-series data
}

async getDashboardStats(userId) {
    // Get overall statistics
}
```

## Testing Requirements

Create `tests/unit/api-analytics.test.js`:

- Test each endpoint returns correct data structure
- Test authentication requirements
- Test error handling
- Test data aggregations
- Test CSV export format

## Migration Checklist

- [ ] Extract endpoint logic from `hosted-index.cjs`
- [ ] Add database methods to `pg-db.js`
- [ ] Add routes to `core/routes.js`
- [ ] Create comprehensive tests
- [ ] Test with actual data
- [ ] Verify CSV export works
- [ ] Update API documentation
- [ ] Delete `hosted-index.cjs` from archive

## Reference

See `archive/legacy-code/hosted-index.cjs.legacy` lines 1917-2250 for original implementation.
