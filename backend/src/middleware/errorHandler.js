import { ZodError } from 'zod';
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
    const isProduction = process.env.NODE_ENV === 'production';
    const responsePayload = {
        statusCode,
        errorCode,
        message: err.message || 'An unexpected error occurred.',
        diagnosticMessage: isProduction ? undefined : err.stack || err.message,
        requestId: req.requestId || req.headers['x-request-id'] || 'REQ-MOCK-ID',
        validationDetails: err.details || undefined,
        timestamp: new Date().toISOString(),
    };
    // Special handling for Zod validation errors
    if (err instanceof ZodError) {
        res.status(400).json({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
            validationDetails: err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            })),
            timestamp: responsePayload.timestamp,
            requestId: responsePayload.requestId,
        });
        return;
    }
    // Handle Mongoose duplicate key errors
    if (err.code === 11000) {
        const fields = Object.keys(err.keyPattern || {});
        res.status(409).json({
            statusCode: 409,
            errorCode: 'DUPLICATE_RECORD',
            message: `A record with this ${fields.join(', ')} already exists.`,
            timestamp: responsePayload.timestamp,
            requestId: responsePayload.requestId,
        });
        return;
    }
    res.status(statusCode).json(responsePayload);
};
