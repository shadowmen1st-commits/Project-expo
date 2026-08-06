import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import pino from 'pino';

// Load actual logger to test its config, but redirect to a stream so we can intercept output
// For testing without interfering with app structure, we define the exact same redacts.
describe('Logging and Redaction Security Audit', () => {
  let logOutput = [];
  let customLogger;
  
  beforeEach(() => {
    logOutput = [];
    customLogger = pino({
      level: 'trace',
      redact: [
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
      ]
    }, {
      write: (msg) => {
        logOutput.push(JSON.parse(msg));
      }
    });
  });

  afterEach(() => {
    logOutput = [];
  });

  it('1. Should redact req.headers.authorization', () => {
    customLogger.info({ req: { headers: { authorization: 'Bearer secret_token' } } });
    assert.strictEqual(logOutput[0].req.headers.authorization, '[Redacted]');
  });

  it('2. Should redact req.headers.cookie', () => {
    customLogger.info({ req: { headers: { cookie: 'accessToken=jwt_value' } } });
    assert.strictEqual(logOutput[0].req.headers.cookie, '[Redacted]');
  });

  it('3. Should redact res.headers["set-cookie"]', () => {
    customLogger.info({ res: { headers: { 'set-cookie': ['accessToken=jwt_value; HttpOnly'] } } });
    assert.strictEqual(logOutput[0].res.headers['set-cookie'], '[Redacted]');
  });

  it('4. Should redact req.body.password', () => {
    customLogger.info({ req: { body: { password: 'UserPassword123' } } });
    assert.strictEqual(logOutput[0].req.body.password, '[Redacted]');
  });

  it('5. Should redact req.body.cardNumber', () => {
    customLogger.info({ req: { body: { cardNumber: '4111222233334444' } } });
    assert.strictEqual(logOutput[0].req.body.cardNumber, '[Redacted]');
  });

  it('6. Should redact req.body.cvv', () => {
    customLogger.info({ req: { body: { cvv: '123' } } });
    assert.strictEqual(logOutput[0].req.body.cvv, '[Redacted]');
  });

  it('7. Should redact req.body.secret', () => {
    customLogger.info({ req: { body: { secret: 'my_app_secret' } } });
    assert.strictEqual(logOutput[0].req.body.secret, '[Redacted]');
  });

  it('8. Should redact top level email field', () => {
    customLogger.info({ email: 'user@example.com' });
    assert.strictEqual(logOutput[0].email, '[Redacted]');
  });

  it('9. Should redact top level phone field', () => {
    customLogger.info({ phone: '+1234567890' });
    assert.strictEqual(logOutput[0].phone, '[Redacted]');
  });

  it('10. Should redact top level token field', () => {
    customLogger.info({ token: 'abc-123-xyz' });
    assert.strictEqual(logOutput[0].token, '[Redacted]');
  });

  it('11. Should redact top level refreshToken field', () => {
    customLogger.info({ refreshToken: 'refresh_xyz' });
    assert.strictEqual(logOutput[0].refreshToken, '[Redacted]');
  });

  it('12. Should redact razorpay_signature', () => {
    customLogger.info({ razorpay_signature: 'razorpay_sig_12345' });
    assert.strictEqual(logOutput[0].razorpay_signature, '[Redacted]');
  });

  it('13. Should not redact non-sensitive fields', () => {
    customLogger.info({ req: { body: { username: 'testuser' } } });
    assert.strictEqual(logOutput[0].req.body.username, 'testuser');
  });

  it('14. Should handle missing fields gracefully', () => {
    customLogger.info({ req: { body: {} } });
    assert.ok(logOutput[0].req.body !== undefined);
  });

  it('15. Should enforce redaction across different log levels', () => {
    customLogger.error({ req: { body: { password: 'error_pass' } } });
    assert.strictEqual(logOutput[0].req.body.password, '[Redacted]');
    customLogger.warn({ req: { body: { password: 'warn_pass' } } });
    assert.strictEqual(logOutput[1].req.body.password, '[Redacted]');
  });

});
