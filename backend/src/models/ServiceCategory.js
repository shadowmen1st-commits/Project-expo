import { Schema, model } from 'mongoose';
const serviceCategorySchema = new Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'wrench' }, // lucide icon name or image path
    image: { type: String },
    parentCategory: { type: Schema.Types.ObjectId, ref: 'ServiceCategory' },
    requiredDocuments: [{ type: String }],
    requiredSkills: [{ type: String }],
    minimumExperience: { type: Number, default: 0 },
    defaultCommission: { type: Number, required: true, default: 10 },
    minimumBookingDuration: { type: Number, default: 1 },
    durationHours: { type: Number, default: 2 },
    price: { type: Number, default: 499 }, // In INR
    cancellationRules: { type: String },
    status: {
        type: String,
        enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
        default: 'ACTIVE'
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, {
    timestamps: true,
});
// Indexes (non-unique only — unique slug auto-indexed)
serviceCategorySchema.index({ status: 1 });
serviceCategorySchema.index({ isActive: 1 });
serviceCategorySchema.index({ sortOrder: 1 });
export const ServiceCategory = model('ServiceCategory', serviceCategorySchema);
export default ServiceCategory;

