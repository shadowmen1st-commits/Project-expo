import { ZodError } from 'zod';
export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
    let message = err.message || 'An unexpected error occurred.';

    // Map Multer limit errors and null-byte TypeErrors to 400
    if (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError') {
        statusCode = 400;
        errorCode = 'FILE_TOO_LARGE';
        message = 'Uploaded file size exceeds the allowed limit.';
    } else if (err.message && (
        err.message.includes('null byte') || 
        err.message.includes('null bytes') || 
        err.message.includes('invalid characters') || 
        err.message.includes('Malformed part header')
    )) {
        statusCode = 400;
        errorCode = 'FILE_INVALID_NAME';
        message = 'File name contains invalid characters.';
    } else if (err.message === 'FILE_PATH_TRAVERSAL_DETECTED') {
        statusCode = 400;
        errorCode = 'FILE_PATH_TRAVERSAL_DETECTED';
        message = 'Path traversal detected in file name.';
    } else if (err.message === 'FILE_INVALID_NAME') {
        statusCode = 400;
        errorCode = 'FILE_INVALID_NAME';
        message = 'File name is invalid.';
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const responsePayload = {
        statusCode,
        errorCode,
        message,
        diagnosticMessage: isProduction ? undefined : err.stack || err.message,
        requestId: req.requestId || req.headers['x-request-id'] || 'REQ-MOCK-ID',
        validationDetails: err.details || undefined,
        timestamp: new Date().toISOString(),
    };
    // Special handling for Zod validation errors
    if (err instanceof ZodError) {
        const pincodeErr = err.errors.find((e) => e.path.includes('pincode'));
        if (pincodeErr) {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'INVALID_PINCODE',
                message: pincodeErr.message || 'PIN code must be exactly 6 digits.',
                timestamp: responsePayload.timestamp,
                requestId: responsePayload.requestId,
            });
            return;
        }

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
    // Handle Mongoose CastError (e.g. invalid ObjectId format)
    if (err.name === 'CastError') {
        res.status(400).json({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Invalid input identifier format.',
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
