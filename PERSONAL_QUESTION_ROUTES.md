# Personal Question API Routes to Migrate

Based on analysis of `core/hosted-index.cjs`, the following personal question API routes need to be migrated to production:

## Routes Found

### 1. GET /api/personal-questions
- **Purpose**: List all active personal questions for authenticated user
- **Auth**: Required (ensureAuthenticated)
- **Query**: `SELECT * FROM personal_questions WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`
- **Line**: 1039-1050

### 2. POST /api/personal-questions
- **Purpose**: Create a new personal question
- **Auth**: Required (ensureAuthenticated)
- **Body**: `{ question, context }`
- **Validation**: Both question and context required
- **Special**: Handles debug user (id=999999) creation
- **Line**: 1052-1083

### 3. PUT /api/personal-questions/:id
- **Purpose**: Update an existing personal question
- **Auth**: Required (ensureAuthenticated)
- **Params**: `id` (question ID)
- **Body**: `{ question, context }`
- **Validation**: Both question and context required, user ownership check
- **Line**: 1085-1108

### 4. DELETE /api/personal-questions/:id
- **Purpose**: Soft delete a personal question (set is_active = false)
- **Auth**: Required (ensureAuthenticated)
- **Params**: `id` (question ID)
- **Query**: `UPDATE personal_questions SET is_active = false WHERE id = $1 AND user_id = $2`
- **Line**: 1110-1130

### 5. GET /api/personal-questions/:id/answers
- **Purpose**: Get all answers for a specific personal question
- **Auth**: Required (ensureAuthenticated)
- **Params**: `id` (question ID)
- **Query**: `SELECT * FROM answers WHERE personal_question_id = $1 AND user_id = $2 ORDER BY date DESC`
- **Line**: 1255-1272

### 6. POST /api/personal-questions/:id/schedule
- **Purpose**: Create or update schedule for a personal question
- **Auth**: Required (ensureAuthenticated)
- **Params**: `id` (question ID)
- **Body**: `{ frequency_type, frequency_value, frequency_unit, selected_models }`
- **Validation**: frequency_type and selected_models required, user ownership check
- **Line**: 1274-1330

### 7. GET /api/personal-questions/:id/schedule
- **Purpose**: Get schedule for a personal question
- **Auth**: Required (ensureAuthenticated)
- **Params**: `id` (question ID)
- **Query**: `SELECT * FROM question_schedules WHERE question_id = $1 AND user_id = $2`
- **Line**: 1332-1351

### 8. DELETE /api/personal-questions/:id/schedule
- **Purpose**: Delete schedule for a personal question
- **Auth**: Required (ensureAuthenticated)
- **Params**: `id` (question ID)
- **Query**: `DELETE FROM question_schedules WHERE question_id = $1 AND user_id = $2`
- **Line**: 1353-1370

## Implementation Strategy

These routes need to be:
1. Migrated to `core/routes.js` using the router pattern
2. Updated to use the database abstraction layer (db.* methods) instead of direct pool queries
3. Tested to ensure they work with the current authentication middleware (ensureAuthenticated)
4. May require adding new methods to `core/pg-db.js` and `local/local-database.js`

## Database Methods Needed

The following database methods may need to be added:

- `db.getPersonalQuestions(userId)` - Get all active personal questions for user
- `db.createPersonalQuestion(userId, question, context)` - Create new personal question
- `db.updatePersonalQuestion(id, userId, question, context)` - Update personal question
- `db.deletePersonalQuestion(id, userId)` - Soft delete personal question
- `db.getPersonalQuestionAnswers(questionId, userId)` - Get answers for personal question
- `db.createQuestionSchedule(questionId, userId, scheduleData)` - Create/update schedule
- `db.getQuestionSchedule(questionId, userId)` - Get schedule
- `db.deleteQuestionSchedule(questionId, userId)` - Delete schedule

## Priority

**High** - These routes are critical for the personal questions feature, which appears to be a core part of the application based on the UI references.
