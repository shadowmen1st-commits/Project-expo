const unsafe = new Set(['POST','PUT','PATCH','DELETE']);
const cookieAuth = req => /(?:^|;\s*)(?:access_token|refreshToken)=/.test(String(req.headers.cookie || ''));

const isOriginAllowed = (origin, allowedOrigins) => {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
};

export const browserOriginGuard = allowedOrigins => (req,res,next) => {
  if (!unsafe.has(req.method) || !cookieAuth(req) || (process.env.NODE_ENV === 'test' && process.env.CSRF_ENFORCE_IN_TEST !== 'true')) return next();
  
  // Bypass CSRF for native mobile/non-browser clients (like Dalvik/OkHttp) which do not send Origin or Referer
  if (!req.headers.origin && !req.headers.referer) return next();

  const candidate = req.headers.origin || (() => { try { return new URL(req.headers.referer).origin; } catch { return ''; } })();
  if (!candidate || !isOriginAllowed(candidate, allowedOrigins)) return res.status(403).json({statusCode:403,errorCode:'CSRF_ORIGIN_REJECTED',message:'Request origin is not allowed.'});
  next();
};
export default browserOriginGuard;
