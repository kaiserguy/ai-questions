const express = require("express");
const cron = require("node-cron");

module.exports = (db, ai, wikipedia, config) => {
    const router = express.Router();

    // Daily Questions Array (Common to both, but can be loaded from DB or config)
    const DAILY_QUESTIONS = [
        {
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

    // Helper function to get today's question
    const getTodayQuestion = () => {
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        return DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length];
    };

    // Middleware to ensure user is authenticated (for public version)
    const ensureAuthenticated = (req, res, next) => {
        if (config.isLocal || req.isAuthenticated()) {
            return next();
        }
        res.redirect("/login");
    };

    // Route for the main page
    router.get("/", async (req, res) => {
        const todayQuestion = getTodayQuestion();
        let todayAnswer = null;
        let allModels = [];
        let indexFlavor = "hosted-index"
        console.log(`[DEBUG] Config object:`, config);
        console.log(`[DEBUG] config.isLocal:`, config.isLocal);
        if (config.isLocal) {
            indexFlavor = "local-index"
        }
        try {
            // Fetch all available models
            const modelsResponse = await ai.listModels(req.user ? req.user.id : null);
            allModels = modelsResponse.models;

            // Try to get an answer for today's question from any model
            for (const model of allModels) {
                const answer = await db.getAnswer(todayQuestion.question, model.id);
                if (answer) {
                    todayAnswer = answer;
                    break;
                }
            }
        } catch (error) {
            console.error("Error fetching data for main page:", error);
        }

        console.log(`[DEBUG] Rendering view: ${indexFlavor}, isLocal: ${config.isLocal}`);
        res.render(indexFlavor, {
            user: req.user,
            todayQuestion,
            todayAnswer,
            allModels,
            isLocal: config.isLocal,
            latestAnswers: [] // Ensure latestAnswers is always defined
        });
    });

    // API to get daily question and answer
    router.get("/api/daily-question", ensureAuthenticated, async (req, res) => {
        const dailyQuestion = getTodayQuestion();
        let answer = null;
        let allModels = [];

        try {
            const modelsResponse = await ai.listModels(req.user ? req.user.id : null);
            allModels = modelsResponse.models;

            for (const model of allModels) {
                const ans = await db.getAnswer(dailyQuestion.question, model.id);
                if (ans) {
                    answer = ans;
                    break;
                }
            }
        } catch (error) {
            console.error("Error fetching daily question and answer:", error);
        }

        if (answer) {
            res.json({ question: dailyQuestion, answer: answer, allModels: allModels, user: req.user, context: answer.context, prompt_version: answer.prompt_version });
        } else {
            res.json({ question: dailyQuestion, answer: null, allModels: allModels, user: req.user });
        }
    });

    // API to generate a new answer
    router.post("/api/generate-answer", ensureAuthenticated, async (req, res) => {
        const { question, context, modelId } = req.body;
        const userId = req.user ? req.user.id : null;

        if (!question || !modelId) {
            return res.status(400).json({ error: "Question and model ID are required." });
        }

        try {
            const promptVersion = "2.0"; // New concise prompt version
            const aiResponse = await ai.generateResponse(modelId, question, context, userId);
            const savedAnswer = await db.saveAnswer(
                question,
                context,
                aiResponse.answer,
                aiResponse.model,
                aiResponse.model_name,
                aiResponse.confidence,
                new Date(),
                userId,
                null, // personal_question_id
                false, // is_personal
                promptVersion
            );
            res.json({ success: true, answer: savedAnswer });
        } catch (error) {
            console.error("Error generating or saving answer:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // API to get answer history for a question
    router.get("/history", async (req, res) => {
        const questionText = req.query.question;
        const userId = req.user ? req.user.id : null;
        let history = [];

        if (questionText) {
            try {
                history = await db.getHistory(questionText);
            } catch (error) {
                console.error("Error fetching history:", error);
            }
        }

        res.render("history", { question: questionText, history, user: req.user, isLocal: config.isLocal });
    });

    // API to delete an answer
    router.delete("/api/answers/:id", ensureAuthenticated, async (req, res) => {
        const { id } = req.params;
        try {
            await db.deleteAnswer(id);
            res.json({ success: true });
        } catch (error) {
            console.error("Error deleting answer:", error);
            res.status(500).json({ error: "Failed to delete answer." });
        }
    });

    // Public API to get today's question (no authentication required)
    router.get('/api/question', (req, res) => {
        try {
            const todayQuestion = getTodayQuestion();
            if (todayQuestion === null || todayQuestion === undefined) {
                return res.status(404).json({
                    error: 'No question available for today'
                });
            }
            res.json(todayQuestion);
        } catch (error) {
            console.error('Error in question API route:', error);
            res.status(500).json({ 
                error: 'Failed to get question'
            });
        }
    });

    // API to list available AI models
    router.get("/api/models", ensureAuthenticated, async (req, res) => {
        try {
            const modelsResponse = await ai.listModels(req.user ? req.user.id : null);
            res.json(modelsResponse.models);
        } catch (error) {
            console.error("Error listing models:", error);
            res.status(500).json({ error: "Failed to retrieve models." });
        }
    });

    // API route for /api/models/all (alias for /api/models)
    router.get("/api/models/all", ensureAuthenticated, async (req, res) => {
        try {
            const modelsResponse = await ai.listModels(req.user ? req.user.id : null);
            
            // For local version, structure the response as expected by the frontend
            if (config.isLocal) {
                res.json({
                    cloud_models: [],
                    local_models: modelsResponse.models || []
                });
            } else {
                // For hosted version, return the models directly
                res.json(modelsResponse.models);
            }
        } catch (error) {
            console.error("Error listing models:", error);
            res.status(500).json({ error: "Failed to retrieve models." });
        }
    });

    // API route for Ollama models (local models)
    router.get("/api/ollama/models", ensureAuthenticated, async (req, res) => {
        try {
            // For local version, try to get Ollama models
            if (config.isLocal && ai.listOllamaModels) {
                const ollamaModels = await ai.listOllamaModels();
                res.json(ollamaModels);
            } else {
                // Return empty array if not local or no Ollama support
                res.json([]);
            }
        } catch (error) {
            console.error("Error listing Ollama models:", error);
            res.json([]); // Return empty array instead of error for Ollama
        }
    });

    // API to save user model preferences
    router.post("/api/user/model-preferences", ensureAuthenticated, async (req, res) => {
        const { modelId, isEnabled, displayOrder } = req.body;
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return res.status(401).json({ error: "Authentication required." });
        }

        try {
            const preference = await db.saveUserModelPreference(userId, modelId, isEnabled, displayOrder);
            res.json({ success: true, preference });
        } catch (error) {
            console.error("Error saving model preference:", error);
            res.status(500).json({ error: "Failed to save model preference." });
        }
    });

    // API to get user model preferences
    router.get("/api/user/model-preferences", ensureAuthenticated, async (req, res) => {
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return res.status(401).json({ error: "Authentication required." });
        }

        try {
            const preferences = await db.getUserModelPreferences(userId);
            res.json({ success: true, preferences });
        } catch (error) {
            console.error("Error retrieving model preferences:", error);
            res.status(500).json({ error: "Failed to retrieve model preferences." });
        }
    });

    // API to save user API key
    router.post("/api/user/api-key", ensureAuthenticated, async (req, res) => {
        const { provider, apiKey } = req.body;
        const userId = req.user ? req.user.id : null;

        if (!userId) {
            return res.status(401).json({ error: "Authentication required." });
        }

        try {
            const savedKey = await db.saveUserApiKey(userId, provider, apiKey);
            res.json({ success: true, savedKey });
        } catch (error) {
            console.error("Error saving API key:", error);
            res.status(500).json({ error: "Failed to save API key." });
        }
    });

    // Personal Questions Routes
    router.get("/personal-questions", ensureAuthenticated, async (req, res) => {
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.redirect("/login");

        try {
            const personalQuestions = await db.getPersonalQuestions(userId);
            res.render("personal-questions", { user: req.user, personalQuestions, isLocal: config.isLocal });
        } catch (error) {
            console.error("Error fetching personal questions:", error);
            res.status(500).send("Error fetching personal questions");
        }
    });

    router.post("/api/personal-questions", ensureAuthenticated, async (req, res) => {
        const { question, context } = req.body;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.status(401).json({ error: "Authentication required." });

        try {
            const newQuestion = await db.createPersonalQuestion(userId, question, context);
            res.json({ success: true, question: newQuestion });
        } catch (error) {
            console.error("Error creating personal question:", error);
            res.status(500).json({ error: "Failed to create personal question." });
        }
    });

    router.put("/api/personal-questions/:id", ensureAuthenticated, async (req, res) => {
        const { id } = req.params;
        const { question, context } = req.body;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.status(401).json({ error: "Authentication required." });

        try {
            const updatedQuestion = await db.updatePersonalQuestion(id, userId, question, context);
            if (updatedQuestion) {
                res.json({ success: true, question: updatedQuestion });
            } else {
                res.status(404).json({ error: "Personal question not found or not authorized." });
            }
        } catch (error) {
            console.error("Error updating personal question:", error);
            res.status(500).json({ error: "Failed to update personal question." });
        }
    });

    router.delete("/api/personal-questions/:id", ensureAuthenticated, async (req, res) => {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.status(401).json({ error: "Authentication required." });

        try {
            const result = await db.deletePersonalQuestion(id, userId);
            if (result.success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: "Personal question not found or not authorized." });
            }
        } catch (error) {
            console.error("Error deleting personal question:", error);
            res.status(500).json({ error: "Failed to delete personal question." });
        }
    });

    router.get("/personal-question-history/:id", ensureAuthenticated, async (req, res) => {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.redirect("/login");

        try {
            const question = await db.getPersonalQuestionById(id, userId);
            if (!question) return res.status(404).send("Question not found or not authorized.");

            const history = await db.getPersonalQuestionAnswers(id, userId);
            res.render("personal-question-history", { user: req.user, question, history, isLocal: config.isLocal });
        } catch (error) {
            console.error("Error fetching personal question history:", error);
            res.status(500).send("Error fetching personal question history");
        }
    });

    router.post("/api/generate-personal-answer", ensureAuthenticated, async (req, res) => {
        const { personalQuestionId, question, context, modelId } = req.body;
        const userId = req.user ? req.user.id : null;

        if (!userId || !personalQuestionId || !question || !modelId) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        try {
            const promptVersion = "2.0"; // New concise prompt version
            const aiResponse = await ai.generateResponse(modelId, question, context, userId);
            const savedAnswer = await db.saveAnswer(
                question,
                context,
                aiResponse.answer,
                aiResponse.model,
                aiResponse.model_name,
                aiResponse.confidence,
                new Date(),
                userId,
                personalQuestionId,
                true, // is_personal
                promptVersion
            );
            res.json({ success: true, answer: savedAnswer });
        } catch (error) {
            console.error("Error generating or saving personal answer:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Scheduling Routes
    router.get("/schedules", ensureAuthenticated, async (req, res) => {
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.redirect("/login");

        try {
            const schedules = await db.getQuestionSchedules(userId);
            const personalQuestions = await db.getPersonalQuestions(userId);
            res.render("schedules", { user: req.user, schedules, personalQuestions, isLocal: config.isLocal });
        } catch (error) {
            console.error("Error fetching schedules:", error);
            res.status(500).send("Error fetching schedules");
        }
    });

    router.post("/api/schedules", ensureAuthenticated, async (req, res) => {
        const { questionId, frequencyType, frequencyValue, frequencyUnit, selectedModels, nextRunDate } = req.body;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.status(401).json({ error: "Authentication required." });

        try {
            const newSchedule = await db.createQuestionSchedule({
                userId, questionId, frequencyType, frequencyValue, frequencyUnit, selectedModels, nextRunDate
            });
            res.json({ success: true, schedule: newSchedule });
        } catch (error) {
            console.error("Error creating schedule:", error);
            res.status(500).json({ error: "Failed to create schedule." });
        }
    });

    router.put("/api/schedules/:id", ensureAuthenticated, async (req, res) => {
        const { id } = req.params;
        const { frequencyType, frequencyValue, frequencyUnit, selectedModels, isEnabled, nextRunDate } = req.body;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.status(401).json({ error: "Authentication required." });

        try {
            const updatedSchedule = await db.updateQuestionSchedule(id, userId, {
                frequencyType, frequencyValue, frequencyUnit, selectedModels, isEnabled, nextRunDate
            });
            if (updatedSchedule) {
                res.json({ success: true, schedule: updatedSchedule });
            } else {
                res.status(404).json({ error: "Schedule not found or not authorized." });
            }
        } catch (error) {
            console.error("Error updating schedule:", error);
            res.status(500).json({ error: "Failed to update schedule." });
        }
    });

    router.delete("/api/schedules/:id", ensureAuthenticated, async (req, res) => {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.status(401).json({ error: "Authentication required." });

        try {
            const result = await db.deleteQuestionSchedule(id, userId);
            if (result.success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: "Schedule not found or not authorized." });
            }
        } catch (error) {
            console.error("Error deleting schedule:", error);
            res.status(500).json({ error: "Failed to delete schedule." });
        }
    });

    router.get("/schedule-executions/:id", ensureAuthenticated, async (req, res) => {
        const { id } = req.params;
        const userId = req.user ? req.user.id : null;
        if (!userId) return res.redirect("/login");

        try {
            const schedule = await db.getQuestionScheduleById(id, userId);
            if (!schedule) return res.status(404).send("Schedule not found or not authorized.");

            const executions = await db.getScheduledExecutions(id, userId);
            res.render("schedule-executions", { user: req.user, schedule, executions, isLocal: config.isLocal });
        } catch (error) {
            console.error("Error fetching schedule executions:", error);
            res.status(500).send("Error fetching schedule executions");
        }
    });

    // Wikipedia Routes
    router.get("/api/wikipedia/search", ensureAuthenticated, async (req, res) => {
        const { query } = req.query;
        try {
            const results = await wikipedia.searchWikipedia(query);
            res.json(results);
        } catch (error) {
            console.error("Wikipedia search error:", error);
            res.status(500).json({ error: "Failed to perform Wikipedia search." });
        }
    });

    router.get("/api/wikipedia/context", ensureAuthenticated, async (req, res) => {
        const { query, maxLength } = req.query;
        try {
            const context = await wikipedia.getWikipediaContext(query, maxLength);
            res.json(context);
        } catch (error) {
            console.error("Wikipedia context error:", error);
            res.status(500).json({ error: "Failed to get Wikipedia context." });
        }
    });

    router.get("/api/wikipedia/stats", ensureAuthenticated, async (req, res) => {
        try {
            const stats = await wikipedia.getWikipediaStats();
            res.json(stats);
        } catch (error) {
            console.error("Wikipedia stats error:", error);
            res.status(500).json({ error: "Failed to get Wikipedia stats." });
        }
    });

    router.get("/api/wikipedia/status", ensureAuthenticated, async (req, res) => {
        try {
            const stats = await wikipedia.getWikipediaStats();
            res.json({
                available: true,
                articleCount: stats.totalArticles || 0,
                databaseSize: stats.databaseSize || 'Unknown'
            });
        } catch (error) {
            console.error("Wikipedia status error:", error);
            res.json({
                available: false,
                error: error.message
            });
        }
    });

    router.get("/api/wikipedia/article", ensureAuthenticated, async (req, res) => {
        const { title } = req.query;
        try {
            const article = await wikipedia.getArticle(title);
            res.json({ article });
        } catch (error) {
            console.error("Wikipedia article error:", error);
            res.status(500).json({ error: "Failed to get Wikipedia article." });
        }
    });

    return router;
};

