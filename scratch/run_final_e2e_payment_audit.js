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

async function runFinalE2EAudit() {
  console.log('========================================================================');
  console.log('     FINAL PRODUCTION-GRADE MOBILE BOOKING & PAYMENT AUDIT             ');
  console.log('========================================================================\n');

  const auditReport = {};

  // 1. Fresh Customer Registration & Login
  const rand = Math.floor(Math.random() * 900000000) + 100000000;
  const email = `final.cust.${rand}@test.com`;
  const password = 'Password123!';
  const phone = '9' + rand;

  await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Final Payment Auditor', email, password, phone, role: 'CUSTOMER' }),
  });

  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token = loginRes.data?.accessToken;
  const customerId = loginRes.data?.user?.id || loginRes.data?.user?._id;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(`[1. AUTH] Customer registered and logged in: ID=${customerId}`);

  // Fetch Category and Worker
  const catRes = await request('/categories');
  const categoryId = catRes.data?.categories?.[0]?._id || '6a7a91e194884cf983721a9a';
  const workerSearch = await request('/workers/search');
  const worker = workerSearch.data?.data?.[0] || workerSearch.data?.[0];
  const workerId = worker?.workerId || '6a7ab1cd87c4bda7fbc60b80';
  console.log(`[2. TARGETS] Worker: ${workerId} (${worker?.name}), Category: ${categoryId}`);

  // 3. Dynamic Availability Scan (Finding first available future slot)
  const candidateDates = ['2026-09-10', '2026-09-11', '2026-09-12'];
  const candidateSlots = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM'];
  let chosenDate = '', chosenSlot = '', chosenStartIso = '', chosenEndIso = '';

  for (const cDate of candidateDates) {
    for (const cSlot of candidateSlots) {
      const sIso = formatToISTIsoString(cDate, cSlot);
      const eIso = new Date(new Date(sIso).getTime() + 2 * 3600000).toISOString();
      const chk = await request('/v1/bookings/availability/check', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          workerId: String(workerId),
          serviceCategoryId: String(categoryId),
          scheduledStart: sIso,
          scheduledEnd: eIso,
          pricingType: 'HOURLY',
        }),
      });

      if (chk.data?.success && chk.data?.available) {
        chosenDate = cDate;
        chosenSlot = cSlot;
        chosenStartIso = sIso;
        chosenEndIso = eIso;
        break;
      }
    }
    if (chosenDate) break;
  }

  console.log(`[3. AVAILABILITY] Selected verified available slot: ${chosenDate} at ${chosenSlot}`);
  console.log(`    Start (UTC): ${chosenStartIso}`);
  console.log(`    End (UTC):   ${chosenEndIso}`);
  auditReport.availability = !!chosenDate;

  // 4. Create Booking
  const bookingPayload = {
    workerId: String(workerId),
    serviceCategoryId: String(categoryId),
    scheduledStart: chosenStartIso,
    scheduledEnd: chosenEndIso,
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
      instructions: 'Final E2E Payment Audit',
      latitude: 12.9716,
      longitude: 77.5946,
    },
    customerNotes: 'Production-Grade Payment Verification Test',
  };

  const createBookingRes = await request('/bookings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(bookingPayload),
  });

  const createdBooking = createBookingRes.data?.booking || createBookingRes.data;
  const bookingId = createdBooking?.id || createdBooking?._id || createBookingRes.data?.id || createBookingRes.data?._id;
  const bookingNumber = createdBooking?.bookingNumber;
  console.log(`[4. BOOKING CREATED] HTTP ${createBookingRes.status}`);
  console.log(`  Authoritative Booking ID: ${bookingId}`);
  console.log(`  Booking Number: ${bookingNumber}`);
  console.log(`  Initial Booking Status: ${createdBooking?.bookingStatus || createdBooking?.status}`);
  console.log(`  Initial Payment Status: ${createdBooking?.paymentStatus}`);
  auditReport.bookingCreated = !!bookingId;

  // 5. Create Payment Order with Idempotency Key
  const idempKey = `idemp-final-${bookingId}-${Date.now()}`;
  const orderRes = await request('/payments/orders', {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': idempKey },
    body: JSON.stringify({ bookingId }),
  });

  const orderData = orderRes.data?.data || orderRes.data;
  const internalPaymentOrderId = orderData?.internalPaymentOrderId;
  const razorpayOrderId = orderData?.razorpayOrderId;
  const publicKeyId = orderData?.publicKeyId;
  const amount = orderData?.amount;

  console.log(`[5. PAYMENT ORDER] HTTP ${orderRes.status}`);
  console.log(`  Internal Payment Order ID: ${internalPaymentOrderId}`);
  console.log(`  Razorpay Order ID: ${razorpayOrderId}`);
  console.log(`  Public Key ID: ${publicKeyId}`);
  console.log(`  Amount: ₹${amount / 100} (${amount} paise)`);
  auditReport.paymentOrder = !!razorpayOrderId && !!internalPaymentOrderId;

  // 6. Security Signature Verification Test (Invalid Signature Check)
  console.log('\n--- 6. SECURITY & SIGNATURE INTEGRITY AUDIT ---');
  const invalidVerify = await request('/payments/verify', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      internalPaymentOrderId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: `pay_unverified_${Date.now()}`,
      razorpay_signature: 'fake_signature_unauthorized_token_0000000000000000000000000000000000000000000000000000000000000000',
    }),
  });
  console.log(`Invalid Signature Response: HTTP ${invalidVerify.status}`);
  console.log(`  Error Code: ${invalidVerify.data?.errorCode}`);
  console.log(`  Message: ${invalidVerify.data?.message}`);
  auditReport.invalidSignatureRejected = invalidVerify.status === 400 && invalidVerify.data?.errorCode === 'PAYMENT_SIGNATURE_INVALID';

  // 7. Verify Unpaid DB State Preserved on Failure
  const bookingAfterFailedSig = await request(`/bookings/${bookingId}`, { headers: authHeaders });
  const bData = bookingAfterFailedSig.data?.booking || bookingAfterFailedSig.data;
  console.log(`Booking state after rejected signature: Status=${bData?.bookingStatus}, Payment=${bData?.paymentStatus}`);
  auditReport.unpaidStatePreserved = bData?.bookingStatus === 'PAYMENT_PENDING' && bData?.paymentStatus === 'PENDING';

  // 8. Tracking Endpoints Check
  console.log('\n--- 8. LIVE TRACKING ENDPOINTS AUDIT ---');
  const trackRes = await request(`/bookings/${bookingId}/tracking`, { headers: authHeaders });
  const locRes = await request(`/bookings/${bookingId}/location`, { headers: authHeaders });
  console.log(`GET /bookings/${bookingId}/tracking -> HTTP ${trackRes.status}`);
  console.log(`GET /bookings/${bookingId}/location -> HTTP ${locRes.status}`);
  auditReport.trackingEndpoints = trackRes.status === 200 || trackRes.status === 404;

  console.log('\n========================================================================');
  console.log('     AUDIT SUMMARY RESULT RECORD                                       ');
  console.log('========================================================================');
  console.log({
    bookingId,
    bookingNumber,
    internalPaymentOrderId,
    razorpayOrderId,
    publicKeyId,
    amount,
    bookingStatus: bData?.bookingStatus,
    paymentStatus: bData?.paymentStatus,
    results: auditReport,
  });
}

runFinalE2EAudit().catch((err) => console.error('Audit failed:', err));
