// Permissions definition
export const ROLE_PERMISSIONS = {
    SUPER_ADMIN: ['*'],
    ADMIN: [
        'users.read',
        'users.manage',
        'workers.read',
        'workers.approve',
        'workers.reject',
        'workers.suspend',
        'documents.review',
        'bookings.read',
        'bookings.manage',
        'payments.read',
        'payments.refund',
        'commissions.manage',
        'payouts.approve',
        'payouts.read',
        'payouts.review',
        'payouts.process',
        'payouts.reconcile',
        'categories.manage',
        'reports.read',
        'settings.manage',
        'audit_logs.read',
        'reviews.read','reviews.moderate','reviews.remove','reviews.restore',
        'reviewReports.read','reviewReports.resolve','reviewRestrictions.manage',
        'support.read','support.reply','support.assign','support.resolve','support.escalate','support.internalNotes',
        'chatReports.read','chatReports.resolve','conversations.moderate','communicationRestrictions.manage',
    ],
    CUSTOMER: [
        'bookings.read',
        'bookings.manage',
        'payments.read',
        'reviews.manage',
    ],
    WORKER: [
        'workers.read',
        'bookings.read',
        'bookings.manage',
        'wallet.read',
        'payouts.manage',
        'reviews.read',
    ],
};
export const requirePermission = (permission) => {
    return (req, res, next) => {
        const user = req.user;
        const requestId = req.requestId || 'REQ-MOCK-ID';
        if (!user) {
            res.status(401).json({
                statusCode: 401,
                errorCode: 'UNAUTHENTICATED',
                message: 'Authentication required.',
                timestamp: new Date().toISOString(),
                requestId,
            });
            return;
        }
        const permissions = ROLE_PERMISSIONS[user.role] || [];
        // Allow if role is SUPER_ADMIN or user holds explicit permission
        const hasAccess = permissions.includes('*') || permissions.includes(permission);
        if (!hasAccess) {
            res.status(403).json({
                statusCode: 403,
                errorCode: 'UNAUTHORIZED',
                message: 'You do not have permission to perform this action.',
                timestamp: new Date().toISOString(),
                requestId,
            });
            return;
        }
        next();
    };
};
