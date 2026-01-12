const logger = require('./logger');
const axios = require("axios");
const AiInterface = require("./ai-interface");
const { InferenceClient } = require("@huggingface/inference");

class ExternalLLMClient extends AiInterface {
    constructor(db) {
        super();
        this.db = db; // Database interface to fetch API keys
        this.huggingface = new InferenceClient(process.env.HUGGING_FACE_API_KEY);
    }

    async generateResponse(model, prompt, context = "", userId = null) {
        let answer = "";
        let modelName = this.getModelDisplayName(model);
        let confidence = 0.95; // Default confidence
        let tokensUsed = 0;
        let responseTime = 0;

        try {
            const fullPrompt = context ? `Based on the following context, please answer this question concisely and directly. Be thorough but efficient with your words:\n\nContext: ${context}\n\nQuestion: ${prompt}\n\nAnswer (be concise):` : prompt;

            let apiKey = null;
            if (userId) {
                apiKey = await this.db.getUserApiKey(userId, this.getProvider(model));
            }
            if (!apiKey) {
                // Fallback to environment variable if user-specific key not found
                switch (this.getProvider(model)) {
                    case "openai":
                        apiKey = process.env.OPENAI_API_KEY;
                        break;
                    case "anthropic":
                        apiKey = process.env.ANTHROPIC_API_KEY;
                        break;
                    case "google":
                        apiKey = process.env.GOOGLE_AI_API_KEY;
                        break;
                    case "huggingface":
                        apiKey = process.env.HUGGING_FACE_API_KEY;
                        break;
                }
            }

            if (!apiKey) {
                throw new Error(`API key not configured for ${modelName}`);
            }

            const startTime = Date.now();

            switch (this.getProvider(model)) {
                case "openai":
                    const openai = axios.create({
                        baseURL: "https://api.openai.com/v1",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json",
                        },
                    });
                    const openaiResponse = await openai.post("/chat/completions", {
                        model: model,
                        messages: [{ role: "user", content: fullPrompt }],
                        temperature: 0.7,
                        max_tokens: 500,
                    });
                    answer = openaiResponse.data.choices[0].message.content;
                    tokensUsed = openaiResponse.data.usage.total_tokens;
                    break;
                case "anthropic":
                    const anthropic = axios.create({
                        baseURL: "https://api.anthropic.com/v1",
                        headers: {
                            "x-api-key": apiKey,
                            "anthropic-version": "2023-06-01",
                            "Content-Type": "application/json",
                        },
                    });
                    const anthropicResponse = await anthropic.post("/messages", {
                        model: model,
                        max_tokens: 500,
                        messages: [{ role: "user", content: fullPrompt }],
                    });
                    answer = anthropicResponse.data.content[0].text;
                    tokensUsed = anthropicResponse.data.usage.input_tokens + anthropicResponse.data.usage.output_tokens;
                    break;
                case "google":
                    const google = axios.create({
                        baseURL: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        params: { key: apiKey },
                    });
                    const googleResponse = await google.post("", {
                        contents: [{ parts: [{ text: fullPrompt }] }],
                    });
                    answer = googleResponse.data.candidates[0].content.parts[0].text;
                    // Google API does not directly provide token count in response, estimate or skip
                    break;
                case "huggingface":
                    // Hugging Face Inference Client handles API key internally if set in constructor
                    const hfResponse = await this.huggingface.textGeneration({
                        model: model,
                        inputs: fullPrompt,
                        parameters: {
                            max_new_tokens: 500,
                            temperature: 0.7,
                        },
                    });
                    answer = hfResponse.generated_text;
                    // Hugging Face API does not directly provide token count in response, estimate or skip
                    break;
                default:
                    throw new Error(`Unsupported model provider: ${this.getProvider(model)}`);
            }

            responseTime = Date.now() - startTime;

            return {
                answer,
                model,
                model_name: modelName,
                confidence,
                tokens_used: tokensUsed,
                response_time: responseTime,
            };
        } catch (error) {
            logger.error(`Error generating response from ${modelName}:`, error.message);
            throw new Error(`External AI model error (${modelName}): ${error.message}`);
        }
    }

    async listModels(userId = null) {
        // This method would typically fetch models from external APIs or a static list.
        // For simplicity, we'll return a static list here.
        let models = [
            // Premium models (API key required) - ChatGPT first as default
            {
                id: "gpt-3.5-turbo",
                name: "ChatGPT (GPT-3.5 Turbo)",
                provider: "openai",
                apiKeyEnv: "OPENAI_API_KEY",
                free: false,
                description: "OpenAI's fast and capable conversational AI model",
                requiresAuth: false, // Changed to false to allow guest usage
                defaultEnabled: true
            },

            // Hugging Face models (updated with working model names)
            {
                id: "microsoft/DialoGPT-medium",
                name: "Microsoft DialoGPT Medium",
                provider: "huggingface",
                apiKeyEnv: "HUGGING_FACE_API_KEY",
                free: false, // Changed to false since using paid API
                description: "Conversational AI model trained on Reddit conversations",
                defaultEnabled: true // Re-enabled
            },
            {
                id: "google/flan-t5-base",
                name: "Google Flan-T5 Base",
                provider: "huggingface",
                apiKeyEnv: "HUGGING_FACE_API_KEY",
                free: false, // Changed to false since using paid API
                description: "Instruction-tuned text-to-text transformer (base model)",
                defaultEnabled: true // Re-enabled
            },
            {
                id: "microsoft/DialoGPT-large",
                name: "Microsoft DialoGPT Large",
                provider: "huggingface",
                apiKeyEnv: "HUGGING_FACE_API_KEY",
                free: false, // Changed to false since using paid API
                description: "Larger conversational AI model with better responses",
                defaultEnabled: true // Re-enabled
            },
            {
                id: "facebook/blenderbot-400M-distill",
                name: "Facebook BlenderBot",
                provider: "huggingface",
                apiKeyEnv: "HUGGING_FACE_API_KEY",
                free: false,
                description: "Open-domain chatbot with engaging conversations",
                defaultEnabled: true
            },

            // Additional OpenAI models
            {
                id: "gpt-4",
                name: "ChatGPT (GPT-4)",
                provider: "openai",
                apiKeyEnv: "OPENAI_API_KEY",
                free: false,
                description: "OpenAI's most advanced reasoning model",
                requiresAuth: false, // Changed to false to allow guest usage
                defaultEnabled: false
            },
            {
                id: "gpt-4-turbo",
                name: "ChatGPT (GPT-4 Turbo)",
                provider: "openai",
                apiKeyEnv: "OPENAI_API_KEY",
                free: false,
                description: "Faster GPT-4 with improved performance",
                requiresAuth: false, // Changed to false to allow guest usage
                defaultEnabled: false
            },
            {
                id: "claude-3-haiku",
                name: "Claude 3 Haiku",
                provider: "anthropic",
                apiKeyEnv: "ANTHROPIC_API_KEY",
                free: false,
                description: "Anthropic's fastest model for simple tasks",
                requiresAuth: true,
                defaultEnabled: true
            },
            {
                id: "claude-3-sonnet",
                name: "Claude 3 Sonnet",
                provider: "anthropic",
                apiKeyEnv: "ANTHROPIC_API_KEY",
                free: false,
                description: "Balanced model for complex reasoning",
                requiresAuth: true,
                defaultEnabled: false
            },
            {
                id: "claude-3-opus",
                name: "Claude 3 Opus",
                provider: "anthropic",
                apiKeyEnv: "ANTHROPIC_API_KEY",
                free: false,
                description: "Anthropic's most powerful model",
                requiresAuth: true,
                defaultEnabled: false
            },
            {
                id: "gemini-pro",
                name: "Google Gemini Pro",
                provider: "google",
                apiKeyEnv: "GOOGLE_AI_API_KEY",
                free: false,
                description: "Google's advanced multimodal AI model",
                requiresAuth: true,
                defaultEnabled: false
            },
            {
                id: "llama-2-70b",
                name: "Meta Llama 2 70B",
                provider: "huggingface",
                apiKeyEnv: "HUGGING_FACE_API_KEY",
                free: false,
                description: "Meta's large language model",
                requiresAuth: true,
                defaultEnabled: false
            },
            {
                id: "mistral-7b",
                name: "Mistral 7B",
                provider: "huggingface",
                apiKeyEnv: "HUGGING_FACE_API_KEY",
                free: false,
                description: "Efficient and powerful open-source model",
                requiresAuth: true,
                defaultEnabled: false
            }
        ];

        if (userId) {
            const userPreferences = await this.db.getUserModelPreferences(userId);
            models = models.map(model => {
                const pref = userPreferences.find(p => p.model_id === model.id);
                if (pref) {
                    return { ...model, isEnabled: pref.is_enabled, displayOrder: pref.display_order };
                } else {
                    return { ...model, isEnabled: model.defaultEnabled, displayOrder: 0 };
                }
            });
        }

        return { models };
    }

    getModelDisplayName(model) {
        const modelMap = this.listModels().models.reduce((acc, m) => {
            acc[m.id] = m.name;
            return acc;
        }, {});
        return modelMap[model] || model;
    }

    getProvider(model) {
        const modelInfo = this.listModels().models.find(m => m.id === model);
        return modelInfo ? modelInfo.provider : null;
    }

    async getRecommendedModels() {
        // This method would typically fetch models from external APIs or a static list.
        // For simplicity, we'll return a static list here.
        return [
            {
                name: "gpt-3.5-turbo",
                displayName: "ChatGPT (GPT-3.5 Turbo)",
                size: "N/A",
                description: "OpenAI's fast and capable conversational AI model",
                recommended: true,
                minRam: "N/A"
            },
            {
                name: "claude-3-haiku",
                displayName: "Claude 3 Haiku",
                size: "N/A",
                description: "Anthropic's fastest model for simple tasks",
                recommended: true,
                minRam: "N/A"
            },
            {
                name: "microsoft/DialoGPT-medium",
                displayName: "Microsoft DialoGPT Medium",
                size: "N/A",
                description: "Conversational AI model trained on Reddit conversations",
                recommended: false,
                minRam: "N/A"
            }
        ];
    }
}

module.exports = ExternalLLMClient;


