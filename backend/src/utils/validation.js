import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email address').transform(value => value.toLowerCase()),
    phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
    password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number'),
    role: z.enum(['CUSTOMER', 'WORKER']).default('CUSTOMER'),
});

export const loginSchema = z.object({
    email: z.string().trim().email('Invalid email address').transform(value => value.toLowerCase()),
    password: z.string().min(1, 'Password is required'),
});

export const workerOnboardingSchema = z.object({
    serviceCategoryIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID')).min(1, 'Select at least one category'),
    skills: z.array(z.string()).min(1, 'Add at least one skill'),
    experienceYears: z.number().min(0, 'Experience years cannot be negative'),
    bio: z.string().min(10, 'Bio must be at least 10 characters'),
    languages: z.array(z.string()).min(1, 'Select at least one language'),
    hourlyRate: z.number().min(0, 'Hourly rate must be positive'),
    dailyRate: z.number().min(0, 'Daily rate must be positive'),
    minimumBookingDuration: z.number().min(1, 'Minimum booking duration is 1 hour'),
    serviceRadiusKm: z.number().min(1, 'Service radius must be at least 1 km'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    dob: z.string().refine((val) => {
        const dobDate = new Date(val);
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
            age--;
        }
        return age >= 18;
    }, 'Worker must be at least 18 years old'),
    documents: z.array(z.object({
        documentType: z.enum([
            'AADHAAR',
            'PAN',
            'DRIVING_LICENSE',
            'ADDRESS_PROOF',
            'POLICE_VERIFICATION',
            'EXPERIENCE_CERTIFICATE',
            'OTHER',
        ]),
        documentNumber: z.string().min(4, 'Document number too short'),
        frontFile: z.string().min(1, 'Front side document image is required'),
        backFile: z.string().optional(),
    })).min(1, 'At least one identification document must be submitted'),
});

export const availabilityCheckSchema = z.object({
    workerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid worker ID'),
    serviceCategoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID').optional(),
    scheduledStart: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
    scheduledEnd: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end date'),
    pricingType: z.enum(['HOURLY', 'DAILY']).optional().default('HOURLY'),
});

export const bookingCreateSchema = z.object({
    workerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid worker ID'),
    serviceCategoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
    serviceAddress: z.string().min(5, 'Address must be detailed'),
    scheduledStart: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
    scheduledEnd: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end date'),
    pricingType: z.enum(['HOURLY', 'DAILY']),
    customerNotes: z.string().optional(),
    couponCode: z.string().optional(),
});

export const bookingCancelSchema = z.object({
    reason: z.string().min(3, 'Cancellation reason is required'),
});

export const bookingRejectSchema = z.object({
    reason: z.string().min(3, 'Rejection reason is required'),
});

export const bookingDisputeSchema = z.object({
    reason: z.string().min(5, 'Dispute reason must be detailed'),
});

export const bookingOverrideSchema = z.object({
    status: z.enum([
        'REQUESTED', 'PAYMENT_PENDING', 'PAID', 'ACCEPTED', 'REJECTED',
        'CONFIRMED', 'WORKER_EN_ROUTE', 'STARTED', 'COMPLETION_REQUESTED',
        'COMPLETED', 'CANCELLED', 'DISPUTED', 'REFUNDED'
    ]),
    reason: z.string().min(5, 'Override reason is mandatory for admin actions'),
});

export const reviewCreateSchema = z.object({
    bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
    rating: z.number().min(1).max(5),
    reviewText: z.string().min(5, 'Review must be at least 5 characters'),
});

export const adminVerifyWorkerSchema = z.object({
    action: z.enum(['APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED', 'SUSPENDED']),
    reason: z.string().min(3, 'Reason is mandatory for verification changes'),
});

export const categoryCreateSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().min(5, 'Description required'),
    icon: z.string().min(1, 'Icon name required'),
    requiredDocuments: z.array(z.string()).default(['AADHAAR']),
    minimumExperience: z.number().default(0),
    defaultCommission: z.number().min(0).max(100),
    minimumBookingDuration: z.number().default(1),
    cancellationRules: z.string().optional(),
});

export const commissionRuleCreateSchema = z.object({
    name: z.string().min(3, 'Rule name is required'),
    serviceCategoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID').optional().nullable(),
    workerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid worker ID').optional().nullable(),
    percentage: z.number().min(0).max(100),
    fixedAmount: z.number().default(0),
    minimumCommission: z.number().default(0),
    maximumCommission: z.number().optional().nullable(),
    priority: z.number().min(1).max(3),
    effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid effective date'),
    effectiveUntil: z.string().optional().nullable().refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid expiry date'),
});
