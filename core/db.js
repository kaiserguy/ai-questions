const DatabaseInterface = require("./db-interface");

// TODO: Replace with actual database implementation
class PlaceholderDatabase extends DatabaseInterface {
    constructor() {
        super();
        this.currentQuestionIndex = 0;
        this.users = [];
        this.personalQuestions = [];
        this.answers = [];
        this.userApiKeys = [];
        this.userModelPreferences = [];
        this.questionSchedules = [];
        this.scheduledExecutions = [];
        this.personalQuestionAnswers = [];
        this.dailyQuestions = [
            {
                id: 1,
                question: "In '1984', was Winston Smith's rebellion against the Party justified? Why or why not?",
                context: "In George Orwell's novel '1984', Winston Smith works at the Ministry of Truth but secretly rebels against the totalitarian regime of Big Brother and the Party. He keeps a diary, engages in a forbidden relationship with Julia, and seeks out the Brotherhood resistance movement."
            },
            {
                id: 2,
                question: "Is the concept of 'doublethink' from '1984' present in today's society? Provide specific examples.",
                context: "In '1984', doublethink is described as the act of simultaneously accepting two mutually contradictory beliefs as correct. It involves the ability to tell deliberate lies while genuinely believing in them, to forget any fact that has become inconvenient, and then to draw it back from oblivion when needed."
            },
            {
                id: 3,
                question: "Compare the surveillance state in '1984' with modern data collection practices. Are there meaningful differences, and why?",
                context: "In '1984', the Party monitors citizens through telescreens that both transmit and record, the Thought Police, and children who spy on their parents. Modern data collection includes internet tracking, smartphone location data, facial recognition, and various forms of digital surveillance by both governments and corporations."
            },
            {
                id: 4,
                question: "In '1984', the Party rewrites history. What are the dangers of historical revisionism, and do you see examples today?",
                context: "In '1984', Winston Smith works at the Ministry of Truth where he alters historical documents to match the Party's ever-changing version of history. The novel portrays a society where 'Who controls the past controls the future. Who controls the present controls the past.'"
            },
            {
                id: 5,
                question: "How does the concept of 'Newspeak' in '1984' relate to modern political language? Give examples.",
                context: "Newspeak in '1984' is a controlled language created by the Party to limit freedom of thought. It eliminates nuance and restricts the range of ideas that can be expressed. Words like 'doublethink', 'thoughtcrime', and 'unperson' demonstrate how language can be manipulated to control thought."
            },
            {
                id: 6,
                question: "Was Julia a true rebel against the Party in '1984', or was her rebellion superficial? Explain your reasoning.",
                context: "In '1984', Julia is Winston's lover who appears to rebel against the Party through illegal sexual relationships and obtaining black market goods. However, her rebellion seems focused on personal pleasure rather than ideological opposition, unlike Winston who questions the Party's control of reality itself."
            },
            {
                id: 7,
                question: "In '1984', what does the slogan 'Freedom is Slavery' mean, and is there any truth to it in our society?",
                context: "In '1984', the Party's three slogans are 'War is Peace', 'Freedom is Slavery', and 'Ignorance is Strength'. These paradoxes are central to the Party's control through doublethink."
            },
            {
                id: 8,
                question: "Discuss the role of technology in '1984' as a tool of oppression. How does this compare to technology's role today?",
                context: "Technology in '1984' is primarily used for surveillance and control, such as telescreens, hidden microphones, and advanced weaponry. Today, technology offers both liberation and control, with concerns about privacy, data collection, and algorithmic manipulation."
            },
            {
                id: 9,
                question: "How does '1984' explore the themes of individuality versus conformity?",
                context: "'1984' depicts a society where individuality is suppressed, and conformity to the Party's ideology is enforced through constant surveillance, propaganda, and re-education. Winston's struggle is a battle to maintain his own thoughts and identity."
            },
            {
                id: 10,
                question: "What is the significance of Room 101 in '1984'?",
                context: "Room 101 is the torture chamber in the Ministry of Love where prisoners are subjected to their worst fears. It is the ultimate tool of the Party to break individuals and force them to conform."
            }
        ];
        this.nextUserId = 1;
        this.nextQuestionId = 1;
        this.nextAnswerId = 1;
        this.nextApiKeyId = 1;
        this.nextModelPrefId = 1;
        this.nextScheduleId = 1;
        this.nextExecutionId = 1;
        this.nextPersonalQuestionAnswerId = 1;
    }

    async initialize() {
        console.log("Placeholder database initialized.");
        return { success: true };
    }

    async getDailyQuestion(date) {
        // TODO: Implement actual database query for daily question
        // Get next question in sequence
        const questionIndex = this.currentQuestionIndex % this.dailyQuestions.length;
        this.currentQuestionIndex = (this.currentQuestionIndex + 1) % this.dailyQuestions.length;
        return this.dailyQuestions[questionIndex];
    }

    async getAnswer(question, model) {
        // TODO: Implement actual database query for answer
        return this.answers.find(a => a.question === question && a.model === model);
    }

    async saveAnswer(question, context, answer, model, modelName, confidence, date, userId, personalQuestionId, isPersonal, promptVersion) {
        const newAnswer = {
            id: this.nextAnswerId++,
            question,
            context,
            answer,
            model,
            modelName,
            confidence,
            date,
            userId,
            personalQuestionId,
            isPersonal,
            promptVersion
        };
        this.answers.push(newAnswer);
        return newAnswer;
    }

    async getHistory(question) {
        return this.answers.filter(a => a.question === question).sort((a, b) => b.date - a.date);
    }

    async deleteAnswer(id) {
        const initialLength = this.answers.length;
        this.answers = this.answers.filter(a => a.id !== id);
        return { success: this.answers.length < initialLength };
    }

    async getUser(googleId) {
        return this.users.find(u => u.google_id === googleId);
    }

    async createUser(googleId, email, name, avatarUrl) {
        const newUser = {
            id: this.nextUserId++,
            google_id: googleId,
            email,
            name,
            avatar_url: avatarUrl,
            created_at: new Date()
        };
        this.users.push(newUser);
        return newUser;
    }

    async getUserById(id) {
        return this.users.find(u => u.id === id);
    }

    async getPersonalQuestions(userId) {
        return this.personalQuestions.filter(pq => pq.user_id === userId);
    }

    async getPersonalQuestionById(questionId, userId) {
        return this.personalQuestions.find(pq => pq.id === questionId && pq.user_id === userId);
    }

    async createPersonalQuestion(userId, question, context) {
        const newPQ = {
            id: this.nextQuestionId++,
            user_id: userId,
            question,
            context,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        };
        this.personalQuestions.push(newPQ);
        return newPQ;
    }

    async updatePersonalQuestion(questionId, userId, question, context) {
        const pq = this.personalQuestions.find(p => p.id === questionId && p.user_id === userId);
        if (pq) {
            pq.question = question;
            pq.context = context;
            pq.updated_at = new Date();
            return pq;
        }
        return null;
    }

    async deletePersonalQuestion(questionId, userId) {
        const initialLength = this.personalQuestions.length;
        this.personalQuestions = this.personalQuestions.filter(pq => !(pq.id === questionId && pq.user_id === userId));
        return { success: this.personalQuestions.length < initialLength };
    }

    async getPersonalQuestionAnswers(questionId, userId) {
        return this.personalQuestionAnswers.filter(pqa => pqa.question_id === questionId && pqa.user_id === userId);
    }

    async saveUserApiKey(userId, provider, apiKey) {
        let existing = this.userApiKeys.find(key => key.user_id === userId && key.provider === provider);
        if (existing) {
            existing.api_key_encrypted = apiKey;
            existing.updated_at = new Date();
            return existing;
        } else {
            const newKey = {
                id: this.nextApiKeyId++,
                user_id: userId,
                provider,
                api_key_encrypted: apiKey,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            };
            this.userApiKeys.push(newKey);
            return newKey;
        }
    }

    async getUserApiKey(userId, provider) {
        const key = this.userApiKeys.find(k => k.user_id === userId && k.provider === provider);
        return key ? key.api_key_encrypted : null;
    }

    async getUserModelPreferences(userId) {
        return this.userModelPreferences.filter(pref => pref.user_id === userId);
    }

    async saveUserModelPreference(userId, modelId, isEnabled, displayOrder) {
        let existing = this.userModelPreferences.find(pref => pref.user_id === userId && pref.model_id === modelId);
        if (existing) {
            existing.is_enabled = isEnabled;
            existing.display_order = displayOrder;
            existing.updated_at = new Date();
            return existing;
        } else {
            const newPref = {
                id: this.nextModelPrefId++,
                user_id: userId,
                model_id: modelId,
                is_enabled: isEnabled,
                display_order: displayOrder,
                created_at: new Date(),
                updated_at: new Date()
            };
            this.userModelPreferences.push(newPref);
            return newPref;
        }
    }

    async getQuestionSchedules(userId) {
        return this.questionSchedules.filter(schedule => schedule.user_id === userId);
    }

    async getQuestionScheduleById(scheduleId, userId) {
        return this.questionSchedules.find(schedule => schedule.id === scheduleId && schedule.user_id === userId);
    }

    async createQuestionSchedule(scheduleData) {
        const newSchedule = {
            id: this.nextScheduleId++,
            created_at: new Date(),
            updated_at: new Date(),
            ...scheduleData
        };
        this.questionSchedules.push(newSchedule);
        return newSchedule;
    }

    async updateQuestionSchedule(scheduleId, userId, scheduleData) {
        const schedule = this.questionSchedules.find(s => s.id === scheduleId && s.user_id === userId);
        if (schedule) {
            Object.assign(schedule, scheduleData);
            schedule.updated_at = new Date();
            return schedule;
        }
        return null;
    }

    async deleteQuestionSchedule(scheduleId, userId) {
        const initialLength = this.questionSchedules.length;
        this.questionSchedules = this.questionSchedules.filter(s => !(s.id === scheduleId && s.user_id === userId));
        return { success: this.questionSchedules.length < initialLength };
    }

    async logScheduledExecution(logData) {
        const newExecution = {
            id: this.nextExecutionId++,
            execution_date: new Date(),
            ...logData
        };
        this.scheduledExecutions.push(newExecution);
        return newExecution;
    }

    async getScheduledExecutions(scheduleId, userId) {
        return this.scheduledExecutions.filter(exec => exec.schedule_id === scheduleId);
    }

    async getDueSchedules() {
        const now = new Date();
        return this.questionSchedules.filter(schedule => schedule.is_enabled && new Date(schedule.next_run_date) <= now);
    }

    async updateScheduleNextRun(scheduleId, nextRunDate) {
        const schedule = this.questionSchedules.find(s => s.id === scheduleId);
        if (schedule) {
            schedule.next_run_date = nextRunDate;
            schedule.last_run_date = new Date();
            return { success: true };
        }
        return { success: false };
    }
}

module.exports = PlaceholderDatabase;

