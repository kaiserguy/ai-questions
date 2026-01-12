/**
 * Centralized Input Validation and Sanitization Utilities
 * 
 * This module provides comprehensive validation and sanitization for all user inputs
 * to prevent XSS, SQL injection, and other security vulnerabilities.
 */

const { body, param, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} - Sanitized string
 */
function sanitizeInput(input, options = {}) {
    if (typeof input !== 'string') {
        return input;
    }
    
    const defaultOptions = {
        allowedTags: [], // No HTML tags allowed by default
        allowedAttributes: {},
        disallowedTagsMode: 'discard',
        enforceHtmlBoundary: true,
    };
    
    return sanitizeHtml(input, { ...defaultOptions, ...options });
}

/**
 * Sanitize text that allows basic formatting
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string with basic formatting allowed
 */
function sanitizeFormattedText(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    return sanitizeHtml(input, {
        allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p'],
        allowedAttributes: {},
        disallowedTagsMode: 'discard',
        enforceHtmlBoundary: true,
    });
}

/**
 * Validate and sanitize request data
 * Middleware to check validation results and return errors
 */
function validateRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
}

/**
 * Validation rules for common fields
 */
const validationRules = {
    // Question validation
    question: () => [
        body('question')
            .trim()
            .notEmpty().withMessage('Question is required')
            .isLength({ min: 3, max: 2000 }).withMessage('Question must be between 3 and 2000 characters')
            .customSanitizer(value => sanitizeInput(value))
    ],
    
    // Context validation
    context: () => [
        body('context')
            .optional()
            .trim()
            .isLength({ max: 5000 }).withMessage('Context must not exceed 5000 characters')
            .customSanitizer(value => sanitizeInput(value))
    ],
    
    // Model ID validation
    modelId: () => [
        body('modelId')
            .trim()
            .notEmpty().withMessage('Model ID is required')
            .isLength({ min: 1, max: 100 }).withMessage('Model ID must be between 1 and 100 characters')
            .matches(/^[a-zA-Z0-9\-_:\/]+$/).withMessage('Invalid model ID format')
            .customSanitizer(value => sanitizeInput(value))
    ],
    
    // Provider validation
    provider: () => [
        body('provider')
            .trim()
            .notEmpty().withMessage('Provider is required')
            .isIn(['openai', 'anthropic', 'google', 'huggingface', 'ollama']).withMessage('Invalid provider')
            .customSanitizer(value => sanitizeInput(value))
    ],
    
    // API Key validation
    apiKey: () => [
        body('apiKey')
            .trim()
            .notEmpty().withMessage('API key is required')
            .isLength({ min: 10, max: 500 }).withMessage('API key must be between 10 and 500 characters')
            .matches(/^[a-zA-Z0-9\-_\.]+$/).withMessage('Invalid API key format')
            // Note: We don't sanitize API keys to preserve their exact format
    ],
    
    // ID parameter validation
    id: () => [
        param('id')
            .trim()
            .notEmpty().withMessage('ID is required')
            .isInt({ min: 1 }).withMessage('ID must be a positive integer')
            .toInt()
    ],
    
    // Query parameter validation
    questionQuery: () => [
        query('question')
            .optional()
            .trim()
            .isLength({ max: 2000 }).withMessage('Question must not exceed 2000 characters')
            .customSanitizer(value => sanitizeInput(value))
    ],
    
    // Limit parameter validation
    limit: () => [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
            .toInt()
    ],
    
    // Model preferences validation
    modelPreferences: () => [
        body('modelId')
            .trim()
            .notEmpty().withMessage('Model ID is required')
            .customSanitizer(value => sanitizeInput(value)),
        body('isEnabled')
            .optional()
            .isBoolean().withMessage('isEnabled must be a boolean')
            .toBoolean(),
        body('displayOrder')
            .optional()
            .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer')
            .toInt()
    ],
    
    // Personal question validation
    personalQuestion: () => [
        body('question')
            .trim()
            .notEmpty().withMessage('Question is required')
            .isLength({ min: 3, max: 2000 }).withMessage('Question must be between 3 and 2000 characters')
            .customSanitizer(value => sanitizeInput(value)),
        body('context')
            .optional()
            .trim()
            .isLength({ max: 5000 }).withMessage('Context must not exceed 5000 characters')
            .customSanitizer(value => sanitizeInput(value))
    ],
    
    // Schedule validation
    schedule: () => [
        body('questionId')
            .trim()
            .notEmpty().withMessage('Question ID is required')
            .isInt({ min: 1 }).withMessage('Question ID must be a positive integer')
            .toInt(),
        body('frequencyType')
            .trim()
            .notEmpty().withMessage('Frequency type is required')
            .isIn(['daily', 'weekly', 'monthly', 'custom']).withMessage('Invalid frequency type')
            .customSanitizer(value => sanitizeInput(value)),
        body('frequencyValue')
            .optional()
            .isInt({ min: 1, max: 365 }).withMessage('Frequency value must be between 1 and 365')
            .toInt(),
        body('frequencyUnit')
            .optional()
            .isIn(['hours', 'days', 'weeks']).withMessage('Invalid frequency unit')
            .customSanitizer(value => sanitizeInput(value)),
        body('selectedModels')
            .optional()
            .isArray().withMessage('Selected models must be an array'),
        body('selectedModels.*')
            .optional()
            .customSanitizer(value => sanitizeInput(value)),
        body('nextRunDate')
            .optional()
            .isISO8601().withMessage('Next run date must be a valid ISO 8601 date')
    ],
    
    // Wikipedia search validation
    wikipediaSearch: () => [
        query('query')
            .trim()
            .notEmpty().withMessage('Search query is required')
            .isLength({ min: 1, max: 200 }).withMessage('Search query must be between 1 and 200 characters')
            .customSanitizer(value => sanitizeInput(value)),
        query('maxLength')
            .optional()
            .isInt({ min: 100, max: 10000 }).withMessage('Max length must be between 100 and 10000')
            .toInt()
    ],
    
    // Wikipedia article validation
    wikipediaArticle: () => [
        query('title')
            .trim()
            .notEmpty().withMessage('Article title is required')
            .isLength({ min: 1, max: 300 }).withMessage('Article title must be between 1 and 300 characters')
            .customSanitizer(value => sanitizeInput(value))
    ],
    
    // Chat message validation
    chatMessage: () => [
        body('message')
            .trim()
            .notEmpty().withMessage('Message is required')
            .isLength({ min: 1, max: 4000 }).withMessage('Message must be between 1 and 4000 characters')
            .customSanitizer(value => sanitizeInput(value)),
        body('model')
            .trim()
            .notEmpty().withMessage('Model is required')
            .customSanitizer(value => sanitizeInput(value)),
        body('context')
            .optional()
            .isArray().withMessage('Context must be an array'),
        body('includeWikipedia')
            .optional()
            .isBoolean().withMessage('includeWikipedia must be a boolean')
            .toBoolean()
    ],
    
    // General text validation
    generalText: (fieldName, minLength = 1, maxLength = 1000) => [
        body(fieldName)
            .trim()
            .isLength({ min: minLength, max: maxLength })
            .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`)
            .customSanitizer(value => sanitizeInput(value))
    ]
};

/**
 * Sanitize object recursively
 * @param {object} obj - Object to sanitize
 * @returns {object} - Sanitized object
 */
function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value);
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

module.exports = {
    sanitizeInput,
    sanitizeFormattedText,
    sanitizeObject,
    validateRequest,
    validationRules
};
