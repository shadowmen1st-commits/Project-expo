const placeholder = /(change[_-]?me|your[_-]|example|placeholder|\.\.\.|test[_-]?secret|fixture)/i;
const present = value => typeof value === 'string' && value.trim().length > 0;
const secureUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname); } catch { return false; } };
const strong = (value, minimum = 32) => present(value) && value.length >= minimum && !placeholder.test(value);
export function validateProductionEnvironment(env) {
  const errors = []; const requireValue = key => { if (!present(env[key])) errors.push(`${key} is required`); };
  for (const key of ['PORT','MONGODB_URI','JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','CORS_ALLOWED_ORIGINS','LOG_LEVEL','TRUST_PROXY']) requireValue(key);
  const frontend = env.FRONTEND_URL || env.CUSTOMER_APP_URL;
  if (!secureUrl(frontend)) errors.push('FRONTEND_URL/CUSTOMER_APP_URL must be a non-local HTTPS URL');
  if (!strong(env.JWT_ACCESS_SECRET)) errors.push('JWT_ACCESS_SECRET must be at least 32 characters and not a placeholder');
  if (!strong(env.JWT_REFRESH_SECRET)) errors.push('JWT_REFRESH_SECRET must be at least 32 characters and not a placeholder');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) errors.push('JWT access and refresh secrets must differ');
  if (!/^(1|true)$/i.test(String(env.TRUST_PROXY || ''))) errors.push('TRUST_PROXY must explicitly enable one trusted proxy hop');
  const origins = String(env.CORS_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => !secureUrl(origin) || origin === '*')) errors.push('CORS_ALLOWED_ORIGINS must contain exact non-local HTTPS origins');
  if (['mock','test'].includes(env.PAYMENT_PROVIDER_MODE)) errors.push('Production payment provider cannot use mock/test mode');
  if (env.PAYMENT_ENABLED !== 'false') for (const key of ['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET']) if (!strong(env[key], key === 'RAZORPAY_KEY_ID' ? 12 : 24)) errors.push(`${key} is missing, weak, or a placeholder`);
  if (env.PAYOUT_ENABLED === 'true') { if (['mock','test'].includes(env.PAYOUT_PROVIDER_MODE)) errors.push('Production payout provider cannot use mock/test mode'); for (const key of ['RAZORPAYX_KEY_ID','RAZORPAYX_KEY_SECRET','RAZORPAYX_ACCOUNT_NUMBER','RAZORPAYX_WEBHOOK_SECRET','PAYOUT_DATA_ENCRYPTION_KEY']) if (!strong(env[key], key === 'PAYOUT_DATA_ENCRYPTION_KEY' ? 32 : 8)) errors.push(`${key} is required for enabled payouts`); }
  if (env.GOOGLE_OAUTH_ENABLED === 'true') { for (const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET']) if (!strong(env[key],12)) errors.push(`${key} is required for Google OAuth`); if (!secureUrl(env.GOOGLE_REDIRECT_URI)) errors.push('GOOGLE_REDIRECT_URI must be non-local HTTPS'); }
  if (env.APPLE_OAUTH_ENABLED === 'true') { for (const key of ['APPLE_CLIENT_ID','APPLE_TEAM_ID','APPLE_KEY_ID','APPLE_PRIVATE_KEY']) if (!present(env[key]) || placeholder.test(env[key])) errors.push(`${key} is required for Apple OAuth`); if (!secureUrl(env.APPLE_REDIRECT_URI)) errors.push('APPLE_REDIRECT_URI must be non-local HTTPS'); }
  if (env.STORAGE_ENABLED === 'true') for (const key of ['STORAGE_PROVIDER','PRIVATE_STORAGE_BUCKET','SIGNED_URL_SECRET']) if (!strong(env[key],key === 'STORAGE_PROVIDER' ? 2 : 16)) errors.push(`${key} is required for enabled storage`);
  if (env.EMAIL_ENABLED === 'true') for (const key of ['EMAIL_PROVIDER','EMAIL_API_KEY','EMAIL_FROM']) if (!present(env[key]) || placeholder.test(env[key])) errors.push(`${key} is required for enabled email`);
  if (errors.length) { const error = new Error(`Production configuration invalid: ${errors.join('; ')}`); error.code='PRODUCTION_CONFIG_INVALID'; error.details=errors; throw error; }
  return {valid:true,errors:[]};
}
export default validateProductionEnvironment;
