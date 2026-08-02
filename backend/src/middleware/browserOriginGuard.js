const unsafe = new Set(['POST','PUT','PATCH','DELETE']);
const cookieAuth = req => /(?:^|;\s*)(?:access_token|refresh_token)=/.test(String(req.headers.cookie || ''));
export const browserOriginGuard = allowedOrigins => (req,res,next) => {
  if (!unsafe.has(req.method) || !cookieAuth(req) || (process.env.NODE_ENV === 'test' && process.env.CSRF_ENFORCE_IN_TEST !== 'true')) return next();
  const candidate = req.headers.origin || (() => { try { return new URL(req.headers.referer).origin; } catch { return ''; } })();
  if (!candidate || !allowedOrigins.includes(candidate)) return res.status(403).json({statusCode:403,errorCode:'CSRF_ORIGIN_REJECTED',message:'Request origin is not allowed.'});
  next();
};
export default browserOriginGuard;
