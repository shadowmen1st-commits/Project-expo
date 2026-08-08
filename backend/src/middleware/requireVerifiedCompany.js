import CompanyProfile from '../models/CompanyProfile.js';

export const requireVerifiedCompany = async (req, res, next) => {
    if (req.user?.role !== 'COMPANY') {
        return res.status(403).json({ 
            statusCode: 403, 
            errorCode: 'FORBIDDEN', 
            message: 'Company account role required.' 
        });
    }

    try {
        const profile = await CompanyProfile.findOne({ userId: req.user.userId });
        if (!profile || profile.verificationStatus !== 'VERIFIED') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'COMPANY_VERIFICATION_REQUIRED',
                message: 'Company verification is required before performing this action.'
            });
        }
        next();
    } catch (error) {
        next(error);
    }
};
