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

const getFrontendBase = () => {
    const raw = process.env.FRONTEND_URL || process.env.CUSTOMER_APP_URL || config.FRONTEND_URL;
    if (raw && !raw.includes('localhost') && !raw.includes('127.0.0.1')) {
        return raw.replace(/\/$/, '');
    }
    return 'https://www.shadowmen.in';
};

const buildRedirectUrl = (frontendBase, targetPath, params = {}) => {
    let urlStr;
    if (targetPath && (targetPath.startsWith('http://') || targetPath.startsWith('https://') || targetPath.includes('://'))) {
        urlStr = targetPath;
    } else {
        const base = (frontendBase || '').replace(/\/+$/, '');
        const path = (targetPath || '/auth/oauth/callback').startsWith('/') ? targetPath : `/${targetPath}`;
        urlStr = `${base}${path}`;
    }
    const hasQuery = urlStr.includes('?');
    const queryParts = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    if (!queryParts) return urlStr;
    return `${urlStr}${hasQuery ? '&' : '?'}${queryParts}`;
};

export const startOAuth = async (req, res, next) => {
    try {
        const providerName = req.params.provider;
        const provider = getProvider(providerName);
        
        if (!provider.isEnabled) {
            return res.status(400).json({ statusCode: 400, errorCode: 'OAUTH_PROVIDER_NOT_CONFIGURED', message: 'Provider disabled.' });
        }

        const rawMode = req.query.mode ? req.query.mode.toUpperCase() : 'LOGIN';
        const mode = (rawMode === 'REGISTER' ? 'SIGNUP' : rawMode);
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

const sendOAuthResponse = (res, redirectUrl) => {
    if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
        return res.redirect(redirectUrl);
    }
    // Custom app scheme (e.g. shadowmen://...)
    // Send an HTML bridge page that triggers the app deep link immediately
    const safeUrl = redirectUrl.replace(/"/g, '&quot;');
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting to Shadowmen App...</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0F172A; color: #FFFFFF; text-align: center; }
        .card { background: #1E293B; border-radius: 16px; padding: 32px 24px; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        .spinner { width: 44px; height: 44px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #EA580C; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { font-size: 20px; margin: 0 0 10px; color: #FFFFFF; }
        p { color: #94A3B8; font-size: 14px; margin: 0 0 24px; }
        a { display: inline-block; background: #EA580C; color: #FFFFFF; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="spinner"></div>
        <h2>Redirecting to App...</h2>
        <p>Authentication complete. Returning you to the Shadowmen mobile application.</p>
        <a href="${safeUrl}">Open App</a>
    </div>
    <script>
        setTimeout(function() {
            window.location.href = "${safeUrl}";
        }, 80);
    </script>
</body>
</html>`);
};

export const oauthCallback = async (req, res, next) => {
    try {
        const providerName = req.params.provider;
        const provider = getProvider(providerName);
        
        // Support Apple form_post (req.body) and standard Google GET (req.query)
        const payload = req.method === 'POST' ? req.body : req.query;
        const { state, code, id_token, user } = payload;
        
        const frontendBase = getFrontendBase();
        
        if (!state || !code) {
            // Usually this means user cancelled or an error occurred. Redirect to frontend with safe error.
            const redirectUrl = buildRedirectUrl(frontendBase, '/auth/oauth/callback', { oauth: 'failed', errorCode: 'OAUTH_CALLBACK_FAILED' });
            return sendOAuthResponse(res, redirectUrl);
        }

        let attempt;
        try {
            attempt = await oauthService.validateStateAndConsumeAttempt(state, providerName.toUpperCase());
        } catch (e) {
            const redirectUrl = buildRedirectUrl(frontendBase, '/auth/oauth/callback', { oauth: 'failed', errorCode: e.message });
            return sendOAuthResponse(res, redirectUrl);
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
                const redirectUrl = buildRedirectUrl(frontendBase, attempt.frontendRedirectPath, { oauth: 'access_denied', errorCode: 'OAUTH_ACCOUNT_DISABLED' });
                return sendOAuthResponse(res, redirectUrl);
            }

            // Create session
            const session = await issueSession(appUser);
            setSessionCookies(res, session.accessToken, session.refreshToken);
            
            attempt.status = 'COMPLETED';
            await attempt.save();

            const redirectUrl = buildRedirectUrl(frontendBase, attempt.frontendRedirectPath, {
                oauth: 'success',
                token: session.accessToken,
                accessToken: session.accessToken,
                refreshToken: session.refreshToken
            });

            return sendOAuthResponse(res, redirectUrl);
        } catch (e) {
            console.error('OAuth Callback Error:', e);
            const errCode = e.message.startsWith('OAUTH_') ? e.message : 'OAUTH_CALLBACK_FAILED';
            const redirectUrl = buildRedirectUrl(frontendBase, attempt?.frontendRedirectPath || '/auth/oauth/callback', { oauth: 'failed', errorCode: errCode });
            return sendOAuthResponse(res, redirectUrl);
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
