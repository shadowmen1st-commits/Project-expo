import { oauthService } from '../services/oauth/OAuthService.js';
import googleOAuthProvider from '../services/oauth/GoogleOAuthProvider.js';
import appleOAuthProvider from '../services/oauth/AppleOAuthProvider.js';
import { hashValue } from '../services/oauth/OAuthUtils.js';
import { setSessionCookies, issueSession, safeUser } from './authController.js'; // Wait, I need to export these from authController

const getProvider = (name) => {
    if (name === 'google') return googleOAuthProvider;
    if (name === 'apple') return appleOAuthProvider;
    throw new Error('OAUTH_INVALID_PROVIDER');
};

export const startOAuth = async (req, res, next) => {
    try {
        const providerName = req.params.provider;
        const provider = getProvider(providerName);
        
        if (!provider.isEnabled) {
            return res.status(400).json({ statusCode: 400, errorCode: 'OAUTH_PROVIDER_NOT_CONFIGURED', message: 'Provider disabled.' });
        }

        const mode = req.query.mode || 'LOGIN';
        const requestedRole = req.query.role;
        const frontendRedirectPath = req.query.redirect || '/auth/oauth/callback';

        const { state, nonce, attemptId } = await oauthService.createAttempt({
            provider: providerName.toUpperCase(),
            mode,
            requestedRole,
            frontendRedirectPath,
            linkingUserId: req.user?.id
        });

        const authUrl = provider.buildAuthorizationUrl(state, nonce);
        return res.json({ success: true, url: authUrl });
    } catch (error) {
        next(error);
    }
};

export const oauthCallback = async (req, res, next) => {
    try {
        const providerName = req.params.provider;
        const provider = getProvider(providerName);
        
        // Support Apple form_post (req.body) and standard Google GET (req.query)
        const payload = req.method === 'POST' ? req.body : req.query;
        const { state, code, id_token, user } = payload;
        
        if (!state || !code) {
            // Usually this means user cancelled or an error occurred. Redirect to frontend with safe error.
            return res.redirect(`${process.env.FRONTEND_URL}/auth/oauth/callback?oauth=failed&errorCode=OAUTH_CALLBACK_FAILED`);
        }

        let attempt;
        try {
            attempt = await oauthService.validateStateAndConsumeAttempt(state, providerName.toUpperCase());
        } catch (e) {
            return res.redirect(`${process.env.FRONTEND_URL}/auth/oauth/callback?oauth=failed&errorCode=${e.message}`);
        }

        try {
            let tokens;
            if (id_token) {
                // Apple sometimes returns id_token directly in form_post
                tokens = { id_token };
            } else {
                tokens = await provider.exchangeAuthorizationCode(code);
            }

            const identityParams = await provider.verifyIdToken(tokens.id_token, attempt.nonceHash);
            // Re-inject Apple's first-time user string if available
            if (providerName === 'apple' && user) {
                const normalizedWithUser = provider.normalizeIdentity({
                    sub: identityParams.providerSubject,
                    email: identityParams.email,
                    email_verified: identityParams.emailVerified,
                    is_private_email: identityParams.privateRelay
                }, user);
                Object.assign(identityParams, normalizedWithUser);
            }

            const { user: appUser } = await oauthService.findOrLinkIdentity(providerName.toUpperCase(), identityParams, attempt, req);

            if (appUser.status !== 'ACTIVE') {
                return res.redirect(`${process.env.FRONTEND_URL}${attempt.frontendRedirectPath}?oauth=access_denied&errorCode=OAUTH_ACCOUNT_DISABLED`);
            }

            // Create session
            const session = await issueSession(appUser);
            setSessionCookies(res, session.accessToken, session.refreshToken);
            
            attempt.status = 'COMPLETED';
            await attempt.save();

            return res.redirect(`${process.env.FRONTEND_URL}${attempt.frontendRedirectPath}?oauth=success`);
        } catch (e) {
            console.error('OAuth Callback Error:', e);
            const errCode = e.message.startsWith('OAUTH_') ? e.message : 'OAUTH_CALLBACK_FAILED';
            return res.redirect(`${process.env.FRONTEND_URL}${attempt.frontendRedirectPath}?oauth=failed&errorCode=${errCode}`);
        }
    } catch (error) {
        next(error);
    }
};

export const getProvidersStatus = async (req, res) => {
    res.json({
        google: { enabled: googleOAuthProvider.isEnabled },
        apple: { enabled: appleOAuthProvider.isEnabled }
    });
};
