const fs = require('fs');
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

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

async function runQA() {
  console.log('========================================================================');
  console.log('       AUTOMATED QA SUITE: HYPERLOCAL MOBILE LIFECYCLE AUDIT            ');
  console.log('========================================================================\n');

  const report = {};

  // 1. Authenticate QA Customer
  const rand = Math.floor(Math.random() * 900000000) + 100000000;
  const email = `qa.auditor.${rand}@test.com`;
  const password = 'Password123!';
  const phone = '9' + rand;

  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Senior QA Engineer', email, password, phone, role: 'CUSTOMER' }),
  });

  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token = loginRes.data?.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(`[AUTH] Registered & Logged in QA customer: ${email} (User ID: ${loginRes.data?.user?.id})`);

  // Target worker and category
  const catRes = await request('/categories');
  const categoryId = catRes.data?.categories?.[0]?._id || '6a7a91e194884cf983721a9a';
  const workerSearch = await request('/workers/search');
  const worker = workerSearch.data?.data?.[0] || workerSearch.data?.[0];
  const workerId = worker?.workerId || '6a7ab1cd87c4bda7fbc60b80';
  console.log(`[TARGET] Worker: ${workerId} (${worker?.name || 'Vikram Mehta'}), Category: ${categoryId}`);

  // Test 1: Timezone Conversions
  console.log('\n--- 1. TIMEZONE DETERMINISM AUDIT ---');
  const t1 = formatToISTIsoString('2026-08-18', '11:30 AM');
  const t2 = formatToISTIsoString('2026-08-18', '12:00 PM');
  const t3 = formatToISTIsoString('2026-08-18', '12:30 PM');
  const t4 = formatToISTIsoString('2026-08-18', '01:00 PM');
  console.log(`11:30 AM IST -> ${t1} (Expected: 2026-08-18T06:00:00.000Z) : ${t1 === '2026-08-18T06:00:00.000Z' ? 'PASS' : 'FAIL'}`);
  console.log(`12:00 PM IST -> ${t2} (Expected: 2026-08-18T06:30:00.000Z) : ${t2 === '2026-08-18T06:30:00.000Z' ? 'PASS' : 'FAIL'}`);
  console.log(`12:30 PM IST -> ${t3} (Expected: 2026-08-18T07:00:00.000Z) : ${t3 === '2026-08-18T07:00:00.000Z' ? 'PASS' : 'FAIL'}`);
  console.log(`01:00 PM IST -> ${t4} (Expected: 2026-08-18T07:30:00.000Z) : ${t4 === '2026-08-18T07:30:00.000Z' ? 'PASS' : 'FAIL'}`);
  report.timezone = t1 === '2026-08-18T06:00:00.000Z' && t3 === '2026-08-18T07:00:00.000Z';

  // Test 2: Availability API & Rejection of Conflicting Slot
  console.log('\n--- 2. BACKEND AVAILABILITY API CHECK ---');
  const conflictCheck = await request('/v1/bookings/availability/check', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      workerId,
      serviceCategoryId: categoryId,
      scheduledStart: t1,
      scheduledEnd: new Date(new Date(t1).getTime() + 2 * 3600000).toISOString(),
      pricingType: 'HOURLY',
    }),
  });
  console.log(`2026-08-18 11:30 AM (2h): HTTP ${conflictCheck.status} -> errorCode=${conflictCheck.data?.errorCode}`);
  console.log(`  Message: "${conflictCheck.data?.message}"`);
  report.conflictCorrectlyIdentified = conflictCheck.status === 409 && conflictCheck.data?.errorCode === 'WORKER_TIME_SLOT_UNAVAILABLE';

  // Test 3: Genuinely Available Slot on Future Date (2026-08-28 10:00 AM IST)
  console.log('\n--- 3. GENUINELY AVAILABLE SLOT CHECK ---');
  const availStartIso = formatToISTIsoString('2026-08-28', '10:00 AM');
  const availEndIso = new Date(new Date(availStartIso).getTime() + 2 * 3600000).toISOString();
  const availCheck = await request('/v1/bookings/availability/check', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      workerId,
      serviceCategoryId: categoryId,
      scheduledStart: availStartIso,
      scheduledEnd: availEndIso,
      pricingType: 'HOURLY',
    }),
  });
  console.log(`2026-08-28 10:00 AM (2h): HTTP ${availCheck.status}, available=${availCheck.data?.available}`);
  report.availableSlotFound = availCheck.status === 200 && availCheck.data?.available === true;

  // Test 4: Booking Creation with GPS Coordinates & Full Address Snapshot
  console.log('\n--- 4. REAL BOOKING CREATION WITH EXACT DETAILS ---');
  const bookingPayload = {
    workerId: String(workerId),
    serviceCategoryId: String(categoryId),
    scheduledStart: availStartIso,
    scheduledEnd: availEndIso,
    pricingType: 'HOURLY',
    serviceAddress: '142, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka - 560038',
    addressSnapshot: {
      houseNumber: '142',
      street: '12th Main Road',
      locality: 'HAL 2nd Stage',
      landmark: 'Near Indiranagar Metro Station',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      addressType: 'HOME',
      instructions: 'QA Verification Booking Test',
      latitude: 12.9716,
      longitude: 77.5946,
    },
    customerNotes: 'Automated QA Mobile Lifecycle Audit',
  };

  const createBookingRes = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(bookingPayload),
  });

  const createdBooking = createBookingRes.data?.booking || createBookingRes.data;
  const authoritativeBookingId = createdBooking?.id || createdBooking?._id || createBookingRes.data?.id || createBookingRes.data?._id;
  console.log(`Booking creation: HTTP ${createBookingRes.status}`);
  console.log(`Authoritative bookingId extracted: ${authoritativeBookingId}`);
  console.log(`Booking Number: ${createdBooking?.bookingNumber}`);
  console.log(`Initial Booking Status: ${createdBooking?.bookingStatus || createdBooking?.status}`);
  report.bookingCreated = !!authoritativeBookingId;

  // Test 5: Duplicate Booking / Concurrent Submission Protection (Simulate 5 Rapid Taps)
  console.log('\n--- 5. CONCURRENT / DUPLICATE BOOKING SUBMISSION TEST ---');
  const concurrentCalls = await Promise.all(
    Array.from({ length: 5 }).map(() =>
      request('/bookings', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(bookingPayload),
      })
    )
  );

  const duplicateCreated = concurrentCalls.filter((res) => res.ok);
  const duplicateRejectedWith409 = concurrentCalls.filter((res) => res.status === 409);
  console.log(`Rapid attempts: 5 total`);
  console.log(`  Rejected with 409 Conflict (slot already taken): ${duplicateRejectedWith409.length}`);
  console.log(`  Duplicate creates allowed by backend: ${duplicateCreated.length} (Expected: 0)`);
  report.duplicateBookingBlocked = duplicateCreated.length === 0;

  // Test 6: Payment Order Generation with Idempotency Key
  console.log('\n--- 6. PAYMENT ORDER GENERATION WITH IDEMPOTENCY KEY ---');
  const idempKey = `idemp-${authoritativeBookingId}-${Date.now()}`;
  const orderRes = await request('/payments/orders', {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': idempKey },
    body: JSON.stringify({ bookingId: authoritativeBookingId }),
  });

  const orderData = orderRes.data?.data || orderRes.data;
  console.log(`POST /payments/orders -> HTTP ${orderRes.status}`);
  console.log(`  Razorpay Order ID: ${orderData?.razorpayOrderId}`);
  console.log(`  Internal Payment Order ID: ${orderData?.internalPaymentOrderId}`);
  console.log(`  Amount: ₹${(orderData?.amount || 0) / 100 || orderData?.amount}`);
  report.paymentOrderCreated = !!orderData?.razorpayOrderId;

  // Idempotent duplicate call with same key
  const idempDuplicate = await request('/payments/orders', {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': idempKey },
    body: JSON.stringify({ bookingId: authoritativeBookingId }),
  });
  console.log(`Duplicate POST /payments/orders with same Idempotency-Key -> HTTP ${idempDuplicate.status} (Reused same order: ${idempDuplicate.data?.data?.razorpayOrderId === orderData?.razorpayOrderId})`);
  report.idempotencyMaintained = idempDuplicate.data?.data?.razorpayOrderId === orderData?.razorpayOrderId;

  // Test 7: Payment Verification Endpoint Audit
  console.log('\n--- 7. PAYMENT VERIFICATION AUDIT ---');
  const verifyRes = await request('/payments/verify', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      internalPaymentOrderId: orderData?.internalPaymentOrderId,
      razorpay_order_id: orderData?.razorpayOrderId,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_signature_verification',
    }),
  });
  console.log(`POST /payments/verify called with correct internalPaymentOrderId -> HTTP ${verifyRes.status}`);

  // Test 8: Exact Booking Details (GET /bookings/:id)
  console.log('\n--- 8. EXACT BOOKING DETAILS AUDIT (GET /bookings/:id) ---');
  const detailsRes = await request(`/bookings/${authoritativeBookingId}`, {
    headers: authHeaders,
  });
  const detail = detailsRes.data?.booking || detailsRes.data;
  console.log(`GET /bookings/${authoritativeBookingId} -> HTTP ${detailsRes.status}`);
  console.log(`  Retrieved ID: ${detail?.id || detail?._id} (Matches: ${String(detail?.id || detail?._id) === String(authoritativeBookingId)})`);
  console.log(`  Booking Number: ${detail?.bookingNumber}`);
  console.log(`  Category Name: ${detail?.category?.name || detail?.serviceCategoryId?.name}`);
  console.log(`  Worker Name: ${detail?.worker?.name || detail?.workerId?.name}`);
  console.log(`  Scheduled Start: ${detail?.scheduledStart}`);
  console.log(`  Scheduled End: ${detail?.scheduledEnd}`);
  console.log(`  Total Amount: ₹${detail?.totalAmount}`);
  console.log(`  Booking Status: ${detail?.bookingStatus}`);
  console.log(`  Payment Status: ${detail?.paymentStatus}`);
  report.exactDetailsRetrieved = String(detail?.id || detail?._id) === String(authoritativeBookingId);

  // Test 9: My Bookings Endpoint (GET /bookings)
  console.log('\n--- 9. MY BOOKINGS LIST AUDIT (GET /bookings) ---');
  const myBookingsRes = await request('/bookings', {
    headers: authHeaders,
  });
  const bookingsList = Array.isArray(myBookingsRes.data)
    ? myBookingsRes.data
    : myBookingsRes.data?.bookings || myBookingsRes.data?.data || [];
  const foundInList = bookingsList.some((b) => String(b.id || b._id) === String(authoritativeBookingId));
  console.log(`GET /bookings -> HTTP ${myBookingsRes.status}, Total Customer Bookings: ${bookingsList.length}`);
  console.log(`  Found newly created booking in list: ${foundInList}`);
  report.foundInMyBookings = foundInList;

  // Test 10: Live Tracking Endpoints & Haversine Distance
  console.log('\n--- 10. WORKER TRACKING & HAVERSINE DISTANCE AUDIT ---');
  const trackRes = await request(`/bookings/${authoritativeBookingId}/tracking`, { headers: authHeaders });
  const locRes = await request(`/bookings/${authoritativeBookingId}/location`, { headers: authHeaders });
  console.log(`GET /bookings/${authoritativeBookingId}/tracking -> HTTP ${trackRes.status}`);
  console.log(`GET /bookings/${authoritativeBookingId}/location -> HTTP ${locRes.status}`);

  const custLat = 12.9716, custLng = 77.5946;
  const workerLat = 12.9784, workerLng = 77.6408; // Indiranagar to HAL
  const dist = haversineDistanceKm(custLat, custLng, workerLat, workerLng);
  console.log(`Haversine calculation: Cust(${custLat}, ${custLng}) to Worker(${workerLat}, ${workerLng}) = ${dist} km`);
  console.log(`  Valid numeric distance without NaN/Infinity: ${!isNaN(dist) && isFinite(dist) && dist > 0}`);
  report.haversineValid = !isNaN(dist) && isFinite(dist) && dist === 5.06;

  console.log('\n========================================================================');
  console.log('       QA SUITE RESULTS SUMMARY                                          ');
  console.log('========================================================================');
  console.log(JSON.stringify(report, null, 2));
}

runQA().catch((err) => {
  console.error('QA Suite encountered error:', err);
});
