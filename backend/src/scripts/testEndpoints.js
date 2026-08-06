import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import { checkAvailability } from '../controllers/bookingController.js';
import { createPriceQuote } from '../controllers/pricingController.js';

async function run() {
    await connectDB();
    const rajesh = await User.findOne({ name: 'Rajesh Kumar' });
    const driverCat = await ServiceCategory.findOne({ slug: 'driver' });

    // Mock Express Req/Res for checkAvailability
    const req = {
        body: {
            workerId: rajesh._id.toString(),
            serviceCategoryId: driverCat._id.toString(),
            scheduledStart: new Date(Date.now() + 86400000).toISOString(),
            scheduledEnd: new Date(Date.now() + 86400000 + 7200000).toISOString(),
            pricingType: 'HOURLY'
        }
    };
    const res = {
        status: function(code) {
            this.code = code;
            return this;
        },
        json: function(data) {
            console.log('checkAvailability response:', this.code, data);
        }
    };
    const next = (err) => console.log('checkAvailability next err:', err);

    await checkAvailability(req, res, next);
    await disconnectDB();
}
run().catch(console.error);
