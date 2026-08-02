import { Schema, model } from 'mongoose';

const oauthAttemptSchema = new Schema({
    provider: { type: String, required: true, enum: ['GOOGLE', 'APPLE'] },
    stateHash: { type: String, required: true },
    nonceHash: { type: String, required: true },
    codeVerifierEncrypted: { type: String }, // optional, for PKCE
    codeChallenge: { type: String }, // optional, for PKCE
    mode: { type: String, required: true, enum: ['LOGIN', 'SIGNUP', 'LINK_ACCOUNT'] },
    requestedRole: { type: String, enum: ['CUSTOMER', 'WORKER'] },
    frontendRedirectPath: { type: String, required: true },
    linkingUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    sessionFingerprintSafe: { type: String }, // basic tracking against CSRF where possible
    status: { 
        type: String, 
        required: true, 
        enum: ['CREATED', 'CALLBACK_RECEIVED', 'COMPLETED', 'FAILED', 'EXPIRED', 'CONSUMED'],
        default: 'CREATED'
    },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date }
}, {
    timestamps: true
});

// TTL index for automatic cleanup of expired attempts
oauthAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
oauthAttemptSchema.index({ stateHash: 1 });

export const OAuthAttempt = model('OAuthAttempt', oauthAttemptSchema);
export default OAuthAttempt;
