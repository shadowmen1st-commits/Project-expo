import { Schema, model } from 'mongoose';

const bookingLocationSchema = new Schema(
    {
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        heading: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
        accuracy: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now, index: true },
    },
    {
        timestamps: true,
    }
);

bookingLocationSchema.index({ bookingId: 1, createdAt: -1 });

export const BookingLocation = model('BookingLocation', bookingLocationSchema);
export default BookingLocation;
