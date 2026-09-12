import axios from 'axios';

const BASE_URL = 'https://project-expo-md7o.onrender.com/api';

async function testBookingFlow() {
    try {
        console.log('--- 1. Authenticating Customer ---');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'demo@jobnest.com',
            password: 'Demo@123'
        });
        const token = loginRes.data.accessToken || loginRes.data.token;
        console.log('Customer logged in:', loginRes.data.user.name);

        const authHeaders = {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };

        console.log('--- 2. Fetching Workers & Categories ---');
        const workersRes = await axios.get(`${BASE_URL}/workers/search`);
        const workerList = workersRes.data.data || workersRes.data.workers || workersRes.data;
        console.log('Available Workers:', workerList.map(w => ({ id: w._id || w.id, name: w.name, category: w.serviceCategories?.[0] })));
        const worker = workerList.find(w => w.name && (w.name.includes('Ayush') || w.name.includes('Harsh') || w.name.includes('Sharma'))) || workerList[1];
        console.log('Selected Worker Full:', JSON.stringify(worker, null, 2));
        const workerIdToUse = worker.workerId || worker.id || worker._id;
        const targetCategoryId = worker.serviceCategoryIds?.[0] || '6a79fa94165ec97eedbe065f';
        console.log('Using Worker User ID:', workerIdToUse, 'Category ID:', targetCategoryId);

        console.log('--- 3. Creating Booking ---');
        // Set scheduled time to 10:00 AM IST tomorrow (04:30 UTC)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2);
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        
        const startISO = `${yyyy}-${mm}-${dd}T04:30:00.000Z`; // 10:00 AM IST
        const endISO = `${yyyy}-${mm}-${dd}T06:30:00.000Z`;   // 12:00 PM IST
        
        const bookingPayload = {
            workerId: workerIdToUse,
            serviceCategoryId: targetCategoryId,
            bookingDate: `${yyyy}-${mm}-${dd}`,
            bookingTime: '10:00 AM',
            durationMinutes: 120,
            pricingType: 'HOURLY',
            serviceAddress: 'Flat 402, Green Valley Apartments, Mumbai - 400001',
            scheduledStart: startISO,
            scheduledEnd: endISO,
            addressSnapshot: {
                houseNumber: 'Flat 402',
                street: 'Green Valley Apartments',
                locality: 'Andheri West',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
                addressType: 'HOME'
            },
            customerNotes: 'Website Flow 2 verification'
        };

        const createRes = await axios.post(`${BASE_URL}/v1/bookings`, bookingPayload, authHeaders);
        const booking = createRes.data.booking;
        const bookingId = booking.id || booking._id;
        console.log('Created Booking ID:', bookingId, 'Booking Number:', booking.bookingNumber);

        console.log('--- 4. Creating Razorpay Payment Order ---');
        const randKey = `idemp-${bookingId}-${Date.now()}`;
        const orderRes = await axios.post(`${BASE_URL}/v1/payments/orders`, {
            bookingId: bookingId
        }, {
            headers: {
                ...authHeaders.headers,
                'Idempotency-Key': randKey
            }
        });
        console.log('Payment Order Created:', orderRes.data);

        console.log('--- 5. Verifying Razorpay Payment ---');
        const internalPaymentOrderId = orderRes.data.data?.internalPaymentOrderId || orderRes.data?.internalPaymentOrderId;
        const razorpayOrderId = orderRes.data.data?.razorpayOrderId || orderRes.data?.razorpayOrderId;
        const paymentId = `pay_${Date.now().toString(36)}`;
        
        const crypto = await import('crypto');
        const signature = crypto.default.createHmac('sha256', 'UVmoRQl5c51d7CoCxJqa3hvY')
            .update(`${razorpayOrderId}|${paymentId}`)
            .digest('hex');

        const verifyRes = await axios.post(`${BASE_URL}/v1/payments/verify`, {
            internalPaymentOrderId: internalPaymentOrderId,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature
        }, authHeaders);
        console.log('Payment Verification Success:', verifyRes.data);

        console.log('--- 6. Fetching Booking Details (Route: /booking/:id) ---');
        const detailsRes = await axios.get(`${BASE_URL}/v1/bookings/${bookingId}`, authHeaders);
        const details = detailsRes.data.booking;

        console.log('\n================ BOOKING DETAILS VERIFICATION ================');
        console.log('✓ Booking ID / Reference:', details.bookingNumber || details.id);
        console.log('✓ Service Category:', details.category?.name || details.serviceCategoryId?.name);
        console.log('✓ Assigned Worker:', details.worker?.name || details.workerId?.name);
        console.log('✓ Scheduled Date:', details.bookingDate);
        console.log('✓ Scheduled Time:', details.bookingTime);
        console.log('✓ Duration (Minutes):', details.durationMinutes);
        console.log('✓ Service Address:', details.serviceAddress);
        console.log('✓ Total Amount (Paise / INR):', details.totalAmount, `(₹${(details.totalAmount/100).toFixed(0)})`);
        console.log('✓ Base Amount:', details.baseAmount, `(₹${(details.baseAmount/100).toFixed(0)})`);
        console.log('✓ Platform Fee:', details.platformFee, `(₹${(details.platformFee/100).toFixed(0)})`);
        console.log('✓ Payment Status:', details.paymentStatus);
        console.log('✓ Booking Status:', details.bookingStatus);
        console.log('✓ Escrow Status:', details.escrowStatus);
        console.log('==============================================================\n');

        if (details.bookingNumber && details.paymentStatus && details.bookingStatus) {
            console.log('ALL REQUIRED BOOKING DETAILS SUCCESSFULLY VERIFIED!');
        }
    } catch (e) {
        console.error('Error during test:', e.response?.data || e.message);
    }
}

testBookingFlow();
