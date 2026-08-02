const target = process.argv[2];
if (!target) throw new Error('A test module path is required.');
Object.assign(process.env,{NODE_ENV:'test',MONGODB_URI:'mongodb://unused/hyperlocal_test',PAYMENT_PROVIDER:'mock',PAYMENT_PROVIDER_MODE:'mock',PAYOUT_PROVIDER:'mock',PAYOUT_PROVIDER_MODE:'mock',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'fixture-secret',RAZORPAY_WEBHOOK_SECRET:'fixture-webhook-secret',PAYOUT_DATA_ENCRYPTION_KEY:'0123456789abcdef0123456789abcdef',JWT_ACCESS_SECRET:'test-access-secret',JWT_REFRESH_SECRET:'test-refresh-secret',CUSTOMER_APP_URL:'http://test.local',WEB_ADMIN_URL:'http://admin.test.local'});
await import(new URL(`../${target}`,import.meta.url));
