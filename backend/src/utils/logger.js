import pino from 'pino';

// Define redaction paths for sensitive data
const redact = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.cardNumber',
  'req.body.cvv',
  'req.body.secret',
  'email',
  'phone',
  'token',
  'refreshToken',
  'razorpay_signature'
];

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
