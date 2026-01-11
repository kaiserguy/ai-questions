# Implementation Guide: Personal Question API Routes (Issue #43)

## Overview

This PR migrates 8 personal question API routes from the unused `core/hosted-index.cjs` file to production (`core/routes.js`). These routes are critical for the personal questions feature.

## Routes to Implement

### 1. GET /api/personal-questions
List all active personal questions for authenticated user.

**Reference**: `core/hosted-index.cjs` lines 1039-1050

**Implementation**:
```javascript
router.get("/api/personal-questions", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const questions = await db.getPersonalQuestions(userId);
        res.json(questions);
    } catch (error) {
        console.error("Error fetching personal questions:", error);
        res.status(500).json({ error: "Failed to fetch personal questions" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async getPersonalQuestions(userId) {
    const result = await this.pool.query(
        'SELECT * FROM personal_questions WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

### 2. POST /api/personal-questions
Create a new personal question.

**Reference**: `core/hosted-index.cjs` lines 1052-1083

**Implementation**:
```javascript
router.post("/api/personal-questions", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const { question, context } = req.body;
        
        if (!question || !context) {
            return res.status(400).json({ error: "Question and context are required" });
        }
        
        const newQuestion = await db.createPersonalQuestion(userId, question, context);
        res.json(newQuestion);
    } catch (error) {
        console.error("Error creating personal question:", error);
        res.status(500).json({ error: "Failed to create personal question" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async createPersonalQuestion(userId, question, context) {
    // Handle debug user - ensure debug user exists in database
    if (userId === 999999) {
        const userCheck = await this.pool.query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );
        
        if (userCheck.rows.length === 0) {
            await this.pool.query(
                'INSERT INTO users (id, google_id, email, name) VALUES ($1, $2, $3, $4)',
                [999999, 'debug-user', 'debug@example.com', 'Debug User']
            );
        }
    }
    
    const result = await this.pool.query(
        'INSERT INTO personal_questions (user_id, question, context, is_active) VALUES ($1, $2, $3, true) RETURNING *',
        [userId, question, context]
    );
    return result.rows[0];
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

### 3. PUT /api/personal-questions/:id
Update an existing personal question.

**Reference**: `core/hosted-index.cjs` lines 1085-1108

**Implementation**:
```javascript
router.put("/api/personal-questions/:id", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const { id } = req.params;
        const { question, context } = req.body;
        
        if (!question || !context) {
            return res.status(400).json({ error: "Question and context are required" });
        }
        
        const updated = await db.updatePersonalQuestion(id, userId, question, context);
        
        if (!updated) {
            return res.status(404).json({ error: "Personal question not found" });
        }
        
        res.json(updated);
    } catch (error) {
        console.error("Error updating personal question:", error);
        res.status(500).json({ error: "Failed to update personal question" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async updatePersonalQuestion(id, userId, question, context) {
    const result = await this.pool.query(
        'UPDATE personal_questions SET question = $1, context = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
        [question, context, id, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

### 4. DELETE /api/personal-questions/:id
Soft delete a personal question (set is_active = false).

**Reference**: `core/hosted-index.cjs` lines 1110-1130

**Implementation**:
```javascript
router.delete("/api/personal-questions/:id", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const { id } = req.params;
        const deleted = await db.deletePersonalQuestion(id, userId);
        
        if (!deleted) {
            return res.status(404).json({ error: "Personal question not found" });
        }
        
        res.json({ success: true, message: "Personal question deleted" });
    } catch (error) {
        console.error("Error deleting personal question:", error);
        res.status(500).json({ error: "Failed to delete personal question" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async deletePersonalQuestion(id, userId) {
    const result = await this.pool.query(
        'UPDATE personal_questions SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

### 5. GET /api/personal-questions/:id/answers
Get all answers for a specific personal question.

**Reference**: `core/hosted-index.cjs` lines 1255-1272

**Implementation**:
```javascript
router.get("/api/personal-questions/:id/answers", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const { id } = req.params;
        const answers = await db.getPersonalQuestionAnswers(id, userId);
        res.json(answers);
    } catch (error) {
        console.error("Error fetching personal question answers:", error);
        res.status(500).json({ error: "Failed to fetch answers" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async getPersonalQuestionAnswers(questionId, userId) {
    const result = await this.pool.query(
        'SELECT * FROM answers WHERE personal_question_id = $1 AND user_id = $2 ORDER BY date DESC',
        [questionId, userId]
    );
    return result.rows;
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

### 6. POST /api/personal-questions/:id/schedule
Create or update schedule for a personal question.

**Reference**: `core/hosted-index.cjs` lines 1274-1330

**Implementation**:
```javascript
router.post("/api/personal-questions/:id/schedule", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const { id } = req.params;
        const { frequency_type, frequency_value, frequency_unit, selected_models } = req.body;
        
        if (!frequency_type || !selected_models || selected_models.length === 0) {
            return res.status(400).json({ error: "Frequency type and selected models are required" });
        }
        
        const schedule = await db.createQuestionSchedule(id, userId, {
            frequency_type,
            frequency_value,
            frequency_unit,
            selected_models
        });
        
        if (!schedule) {
            return res.status(404).json({ error: "Personal question not found" });
        }
        
        res.json(schedule);
    } catch (error) {
        console.error("Error creating schedule:", error);
        res.status(500).json({ error: "Failed to create schedule" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async createQuestionSchedule(questionId, userId, scheduleData) {
    // Verify the question belongs to the user
    const questionResult = await this.pool.query(
        'SELECT id FROM personal_questions WHERE id = $1 AND user_id = $2',
        [questionId, userId]
    );
    
    if (questionResult.rows.length === 0) {
        return null;
    }
    
    const { frequency_type, frequency_value, frequency_unit, selected_models } = scheduleData;
    
    // Check if schedule exists
    const existingSchedule = await this.pool.query(
        'SELECT id FROM question_schedules WHERE question_id = $1 AND user_id = $2',
        [questionId, userId]
    );
    
    if (existingSchedule.rows.length > 0) {
        // Update existing schedule
        const result = await this.pool.query(
            'UPDATE question_schedules SET frequency_type = $1, frequency_value = $2, frequency_unit = $3, selected_models = $4, updated_at = CURRENT_TIMESTAMP WHERE question_id = $5 AND user_id = $6 RETURNING *',
            [frequency_type, frequency_value, frequency_unit, JSON.stringify(selected_models), questionId, userId]
        );
        return result.rows[0];
    } else {
        // Create new schedule
        const result = await this.pool.query(
            'INSERT INTO question_schedules (question_id, user_id, frequency_type, frequency_value, frequency_unit, selected_models) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [questionId, userId, frequency_type, frequency_value, frequency_unit, JSON.stringify(selected_models)]
        );
        return result.rows[0];
    }
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

### 7. GET /api/personal-questions/:id/schedule
Get schedule for a personal question.

**Reference**: `core/hosted-index.cjs` lines 1332-1351

**Implementation**:
```javascript
router.get("/api/personal-questions/:id/schedule", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const { id } = req.params;
        const schedule = await db.getQuestionSchedule(id, userId);
        
        if (!schedule) {
            return res.status(404).json({ error: "No schedule found" });
        }
        
        res.json(schedule);
    } catch (error) {
        console.error("Error fetching schedule:", error);
        res.status(500).json({ error: "Failed to fetch schedule" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async getQuestionSchedule(questionId, userId) {
    const result = await this.pool.query(
        'SELECT * FROM question_schedules WHERE question_id = $1 AND user_id = $2',
        [questionId, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

### 8. DELETE /api/personal-questions/:id/schedule
Delete schedule for a personal question.

**Reference**: `core/hosted-index.cjs` lines 1353-1370

**Implementation**:
```javascript
router.delete("/api/personal-questions/:id/schedule", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        
        const { id } = req.params;
        const deleted = await db.deleteQuestionSchedule(id, userId);
        
        if (!deleted) {
            return res.status(404).json({ error: "No schedule found" });
        }
        
        res.json({ success: true, message: "Schedule deleted" });
    } catch (error) {
        console.error("Error deleting schedule:", error);
        res.status(500).json({ error: "Failed to delete schedule" });
    }
});
```

**Database method needed** (add to `core/pg-db.js`):
```javascript
async deleteQuestionSchedule(questionId, userId) {
    const result = await this.pool.query(
        'DELETE FROM question_schedules WHERE question_id = $1 AND user_id = $2 RETURNING *',
        [questionId, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}
```

**Also add to** `local/local-database.js` with equivalent implementation.

---

## Implementation Checklist

- [ ] Add 8 database methods to `core/pg-db.js`
- [ ] Add 8 database methods to `local/local-database.js`
- [ ] Add 8 API routes to `core/routes.js`
- [ ] Ensure all routes use `ensureAuthenticated` middleware
- [ ] Ensure all routes check user ownership where applicable
- [ ] Test all routes work correctly
- [ ] Run full test suite to ensure nothing broke

## Notes

- All routes require authentication (`ensureAuthenticated`)
- All routes should validate user ownership to prevent unauthorized access
- Use the database abstraction layer (`db.*` methods) instead of direct pool queries
- Follow existing code patterns in `core/routes.js`
- Handle the debug user (id=999999) special case in `createPersonalQuestion`
- Use soft delete (is_active = false) for personal questions, not hard delete

## Success Criteria

- All 8 routes are accessible in production
- All routes properly authenticate users
- All routes validate user ownership
- All routes follow existing code patterns
- Test suite still passes (122/122 tests)
- No breaking changes to existing functionality
