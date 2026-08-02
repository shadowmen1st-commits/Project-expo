import { Schema, model } from 'mongoose';

const oauthIdentitySchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true, enum: ['GOOGLE', 'APPLE'] },
    providerSubject: { type: String, required: true },
    providerEmailNormalized: { type: String, lowercase: true, trim: true },
    providerEmailVerified: { type: Boolean, default: false },
    providerEmailPrivateRelay: { type: Boolean, default: false },
    providerDisplayNameSafe: { type: String },
    providerAvatarUrlSafe: { type: String },
    providerTenant: { type: String },
    linkedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
    status: {
        type: String,
        enum: ['ACTIVE', 'UNLINKED', 'REVOKED', 'REQUIRES_REAUTHENTICATION'],
        default: 'ACTIVE'
    },
    metadataSafe: { type: Schema.Types.Mixed }
}, {
    timestamps: true
});

// Unique index for the provider + subject
oauthIdentitySchema.index({ provider: 1, providerSubject: 1 }, { unique: true });
// Fast lookup by userId and provider
oauthIdentitySchema.index({ userId: 1, provider: 1 });

export const OAuthIdentity = model('OAuthIdentity', oauthIdentitySchema);
export default OAuthIdentity;
