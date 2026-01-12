/**
 * Centralized Error Handling Utility
 * Provides consistent error messages and recovery options throughout the application
 */

/**
 * Standard error types for the application
 */
const ErrorTypes = {
    VALIDATION: 'validation',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    DATABASE: 'database',
    NETWORK: 'network',
    AI_SERVICE: 'ai_service',
    NOT_FOUND: 'not_found',
    SERVER: 'server'
};

/**
 * User-friendly error messages with recovery suggestions
 */
const ErrorMessages = {
    [ErrorTypes.VALIDATION]: {
        title: 'Invalid Input',
        defaultMessage: 'The information provided is not valid.',
        recovery: 'Please check your input and try again.'
    },
    [ErrorTypes.AUTHENTICATION]: {
        title: 'Authentication Required',
        defaultMessage: 'You need to be signed in to perform this action.',
        recovery: 'Please sign in and try again.'
    },
    [ErrorTypes.AUTHORIZATION]: {
        title: 'Access Denied',
        defaultMessage: 'You don\'t have permission to perform this action.',
        recovery: 'Please contact support if you believe this is an error.'
    },
    [ErrorTypes.DATABASE]: {
        title: 'Database Error',
        defaultMessage: 'We encountered a problem accessing your data.',
        recovery: 'Please try again in a moment. If the problem persists, contact support.'
    },
    [ErrorTypes.NETWORK]: {
        title: 'Connection Error',
        defaultMessage: 'We couldn\'t connect to the service.',
        recovery: 'Please check your internet connection and try again.'
    },
    [ErrorTypes.AI_SERVICE]: {
        title: 'AI Service Error',
        defaultMessage: 'The AI service is temporarily unavailable.',
        recovery: 'Please try again in a moment or select a different model.'
    },
    [ErrorTypes.NOT_FOUND]: {
        title: 'Not Found',
        defaultMessage: 'The requested resource could not be found.',
        recovery: 'Please check the URL and try again.'
    },
    [ErrorTypes.SERVER]: {
        title: 'Server Error',
        defaultMessage: 'An unexpected error occurred on our server.',
        recovery: 'Please try again later. If the problem persists, contact support.'
    }
};

/**
 * Create a standardized error response
 */
function createErrorResponse(type, message = null, details = null) {
    const errorInfo = ErrorMessages[type] || ErrorMessages[ErrorTypes.SERVER];
    
    return {
        error: {
            type: type,
            title: errorInfo.title,
            message: message || errorInfo.defaultMessage,
            recovery: errorInfo.recovery,
            details: details,
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Log error with context
 */
function logError(error, context = {}) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error in ${context.operation || 'unknown operation'}:`, {
        message: error.message,
        stack: error.stack,
        context: context
    });
}

/**
 * Express middleware for handling errors
 */
function errorMiddleware(err, req, res, next) {
    // Log the error
    logError(err, {
        operation: `${req.method} ${req.path}`,
        userId: req.user ? req.user.id : 'anonymous',
        body: req.body
    });

    // Determine error type and status code
    let statusCode = err.statusCode || 500;
    let errorType = err.type || ErrorTypes.SERVER;

    // Map common errors to appropriate types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorType = ErrorTypes.VALIDATION;
    } else if (err.name === 'UnauthorizedError' || err.message.includes('authentication')) {
        statusCode = 401;
        errorType = ErrorTypes.AUTHENTICATION;
    } else if (err.message.includes('permission') || err.message.includes('authorized')) {
        statusCode = 403;
        errorType = ErrorTypes.AUTHORIZATION;
    } else if (err.message.includes('not found')) {
        statusCode = 404;
        errorType = ErrorTypes.NOT_FOUND;
    } else if (err.message.includes('database') || err.message.includes('query')) {
        errorType = ErrorTypes.DATABASE;
    } else if (err.message.includes('network') || err.message.includes('ECONNREFUSED')) {
        errorType = ErrorTypes.NETWORK;
    } else if (err.message.includes('AI') || err.message.includes('model')) {
        errorType = ErrorTypes.AI_SERVICE;
    }

    // Create error response
    const errorResponse = createErrorResponse(
        errorType,
        err.userMessage || err.message,
        process.env.NODE_ENV === 'development' ? err.stack : null
    );

    // Send response based on request type
    if (req.accepts('html') && !req.xhr) {
        // Render error page for HTML requests
        res.status(statusCode).render('error', {
            title: errorResponse.error.title,
            error: errorResponse.error,
            user: req.user,
            isLocal: req.app.get('isLocal') || false
        });
    } else {
        // Send JSON for API requests
        res.status(statusCode).json(errorResponse);
    }
}

/**
 * Async route handler wrapper to catch errors
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Custom error class for application errors
 */
class AppError extends Error {
    constructor(type, message, statusCode = 500, details = null) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.statusCode = statusCode;
        this.details = details;
        this.userMessage = message;
    }
}

/**
 * Validation error helper
 */
function createValidationError(message, details = null) {
    return new AppError(ErrorTypes.VALIDATION, message, 400, details);
}

/**
 * Not found error helper
 */
function createNotFoundError(resource = 'Resource') {
    return new AppError(
        ErrorTypes.NOT_FOUND,
        `${resource} not found`,
        404
    );
}

/**
 * Database error helper
 */
function createDatabaseError(operation = 'database operation', originalError = null) {
    return new AppError(
        ErrorTypes.DATABASE,
        `Failed to ${operation}. Please try again.`,
        500,
        originalError ? originalError.message : null
    );
}

/**
 * AI service error helper
 */
function createAIServiceError(message = 'AI service unavailable', details = null) {
    return new AppError(
        ErrorTypes.AI_SERVICE,
        message,
        503,
        details
    );
}

module.exports = {
    ErrorTypes,
    ErrorMessages,
    createErrorResponse,
    logError,
    errorMiddleware,
    asyncHandler,
    AppError,
    createValidationError,
    createNotFoundError,
    createDatabaseError,
    createAIServiceError
};
