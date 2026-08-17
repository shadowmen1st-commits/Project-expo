const crypto = require('crypto');
const BASE_URL = 'https://project-expo-md7o.onrender.com/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return { status: res.status, ok: res.ok, data: json };
  } catch (err) {
    return { status: 500, ok: false, error: err.message };
  }
}

function formatToISTIsoString(dateStr, timeStr) {
  let hours = 10, minutes = 0;
  const match = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
  if (match) {
    hours = parseInt(match[1], 10) || 10;
    minutes = parseInt(match[2], 10) || 0;
    const meridiem = (match[3] || '').toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  }
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const totalUTCMinutes = hours * 60 + minutes - 330;
  return new Date(Date.UTC(year, month, day, 0, totalUTCMinutes, 0, 0)).toISOString();
}

async function testPaymentLifecycle() {
  console.log('========================================================================');
  console.log('       PAYMENT VERIFICATION & LIFECYCLE AUDIT                           ');
  console.log('========================================================================\n');

  // 1. Authenticate Customer
  const rand = Math.floor(Math.random() * 900000000) + 100000000;
  const email = `cust.payment.${rand}@test.com`;
  const password = 'Password123!';
  const phone = '9' + rand;

  await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Payment QA Tester', email, password, phone, role: 'CUSTOMER' }),
  });

  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token = loginRes.data?.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(`[AUTH] Customer authenticated: ID=${loginRes.data?.user?.id}`);

  // Fetch Category and Worker
  const catRes = await request('/categories');
  const categoryId = catRes.data?.categories?.[0]?._id || '6a7a91e194884cf983721a9a';
  const workerSearch = await request('/workers/search');
  const workerId = workerSearch.data?.data?.[0]?.workerId || workerSearch.data?.[0]?.workerId || '6a7ab1cd87c4bda7fbc60b80';

  // 2. Create Booking on valid future date
  const targetDate = '2026-08-30';
  const startIso = formatToISTIsoString(targetDate, '10:00 AM');
  const endIso = new Date(new Date(startIso).getTime() + 2 * 3600000).toISOString();

  const bookingRes = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      workerId: String(workerId),
      serviceCategoryId: String(categoryId),
      scheduledStart: startIso,
      scheduledEnd: endIso,
      pricingType: 'HOURLY',
      serviceAddress: '142, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka - 560038',
      addressSnapshot: {
        houseNumber: '142',
        street: '12th Main Road',
        locality: 'HAL 2nd Stage',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        addressType: 'HOME',
        latitude: 12.9716,
        longitude: 77.5946,
      },
      customerNotes: 'Payment audit booking',
    }),
  });

  const booking = bookingRes.data?.booking || bookingRes.data;
  const bookingId = booking?.id || booking?._id;
  console.log(`[BOOKING] Created: ID=${bookingId}, Status=${booking?.bookingStatus}, PaymentStatus=${booking?.paymentStatus}`);

  // 3. Initiate Payment Order
  const idempKey = `idemp-${bookingId}-${Date.now()}`;
  const orderRes = await request('/payments/orders', {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': idempKey },
    body: JSON.stringify({ bookingId }),
  });

  const orderData = orderRes.data?.data || orderRes.data;
  console.log(`[PAYMENT ORDER] HTTP ${orderRes.status}:`);
  console.log(`  Internal Payment Order ID: ${orderData?.internalPaymentOrderId}`);
  console.log(`  Razorpay Order ID: ${orderData?.razorpayOrderId}`);
  console.log(`  Public Key ID: ${orderData?.publicKeyId}`);
  console.log(`  Amount: ${orderData?.amount} paise (₹${orderData?.amount / 100})`);

  // 4. Test Verification with Invalid Signature (Should reject with HTTP 400)
  console.log('\n--- INVALID SIGNATURE TEST ---');
  const invalidVerifyRes = await request('/payments/verify', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      internalPaymentOrderId: orderData?.internalPaymentOrderId,
      razorpay_order_id: orderData?.razorpayOrderId,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'invalid_signature_hash_0000000000000000000000000000000000000000000000000000000000000000',
    }),
  });

  console.log(`Invalid Signature Attempt: HTTP ${invalidVerifyRes.status}`);
  console.log(`  Error Code: ${invalidVerifyRes.data?.errorCode}`);
  console.log(`  Message: ${invalidVerifyRes.data?.message}`);
  const correctlyRejected = invalidVerifyRes.status === 400 && invalidVerifyRes.data?.errorCode === 'PAYMENT_SIGNATURE_INVALID';
  console.log(`  -> Correctly rejected invalid signature: ${correctlyRejected ? 'PASS' : 'FAIL'}`);

  // Check Booking State after failed signature
  const postFailBooking = await request(`/bookings/${bookingId}`, { headers: authHeaders });
  console.log(`Booking state after failed verification: Status=${postFailBooking.data?.booking?.bookingStatus}, Payment=${postFailBooking.data?.booking?.paymentStatus}`);

  // 5. Test Verification with Valid Signature
  // Read configured RAZORPAY_KEY_SECRET from process.env or test against server
  console.log('\n--- SIGNATURE GENERATION & VERIFICATION AUDIT ---');
  console.log(`Razorpay Order ID: ${orderData?.razorpayOrderId}`);
  console.log(`Public Key ID: ${orderData?.publicKeyId}`);
}

testPaymentLifecycle().catch((err) => console.error('Error:', err));
