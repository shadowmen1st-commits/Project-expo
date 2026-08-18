/**
 * Safe DTO transformations to prevent private data leakage
 */

export const toSafeUserDTO = (user) => {
    if (!user) return null;
    const doc = user.toObject ? user.toObject() : user;
    return {
        id: doc._id || doc.id,
        name: doc.name || 'User',
        profileImage: doc.profileImage || null,
        role: doc.role,
        emailVerified: !!doc.emailVerified,
        phoneVerified: !!doc.phoneVerified,
    };
};

export const toSafeBookingDTO = (booking) => {
    if (!booking) return null;
    const b = booking.toObject ? booking.toObject() : booking;

    const customer = b.customerId && typeof b.customerId === 'object' ? toSafeUserDTO(b.customerId) : b.customerId;
    const worker = b.workerId && typeof b.workerId === 'object' ? toSafeUserDTO(b.workerId) : b.workerId;
    const category = b.serviceCategoryId && typeof b.serviceCategoryId === 'object'
        ? {
            id: b.serviceCategoryId._id || b.serviceCategoryId.id,
            name: b.serviceCategoryId.name,
            icon: b.serviceCategoryId.icon,
            description: b.serviceCategoryId.description,
        }
        : b.serviceCategoryId;

    return {
        id: b._id || b.id,
        bookingNumber: b.bookingNumber,
        customer,
        worker,
        category,
        serviceAddress: b.serviceAddress,
        addressSnapshot: b.addressSnapshot,
        scheduledStart: b.scheduledStart,
        scheduledEnd: b.scheduledEnd,
        bookingDate: b.bookingDate,
        bookingTime: b.bookingTime,
        durationMinutes: b.durationMinutes,
        pricingType: b.pricingType,

        // Financial values in Paise & Rupee display
        baseAmount: b.baseAmount,
        platformFee: b.platformFee,
        taxAmount: b.taxAmount,
        discountAmount: b.discountAmount,
        totalAmount: b.totalAmount,
        commissionPercentage: b.commissionPercentage,
        commissionAmount: b.commissionAmount,
        workerEarning: b.workerEarning,
        currency: b.currency || 'INR',

        // Statuses
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        escrowStatus: b.escrowStatus,

        // Notes & Reasons
        customerNotes: b.customerNotes,
        workerNotes: b.workerNotes,
        cancellationReason: b.cancellationReason,
        rejectionReason: b.rejectionReason,

        // Timestamps
        acceptedAt: b.acceptedAt,
        rejectedAt: b.rejectedAt,
        confirmedAt: b.confirmedAt,
        workerEnRouteAt: b.workerEnRouteAt,
        startedAt: b.startedAt,
        completionRequestedAt: b.completionRequestedAt,
        completedAt: b.completedAt,
        cancelledAt: b.cancelledAt,
        expiresAt: b.expiresAt,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
    };
};
