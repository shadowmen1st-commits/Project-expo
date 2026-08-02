import { Schema, model } from 'mongoose';
const refreshTokenSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    isRevoked: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    replacedByTokenHash: { type: String },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
refreshTokenSchema.index({ expiresAt: 1 });
export const RefreshToken = model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
