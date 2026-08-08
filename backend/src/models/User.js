import { Schema, model } from 'mongoose';
const userSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, select: false },
    authenticationMethods: [{ type: String, enum: ['PASSWORD', 'GOOGLE', 'APPLE'] }],
    primaryAuthenticationMethod: { type: String, enum: ['PASSWORD', 'GOOGLE', 'APPLE'], default: 'PASSWORD' },
    role: {
        type: String,
        enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SUPER_ADMIN', 'COMPANY'],
        default: 'CUSTOMER',
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED'],
        default: 'ACTIVE',
    },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    profileImage: { type: String },
    preferredLanguage: { type: String, default: 'en' },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    deletedAt: { type: Date },
    lastLoginAt: { type: Date },
}, {
    timestamps: true,
});
// Indexes (non-unique only — unique fields are auto-indexed)
userSchema.index({ status: 1 });
export const User = model('User', userSchema);
export default User;
