const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function adb(cmd) {
  try {
    return execSync(`adb ${cmd}`, { encoding: 'utf8', timeout: 30000 });
  } catch (err) {
    console.error(`ADB error on "${cmd}":`, err.message);
    return err.stdout || '';
  }
}

function tap(x, y) {
  console.log(`[ADB] Tap (${x}, ${y})`);
  adb(`shell input tap ${x} ${y}`);
}

function swipe(x1, y1, x2, y2, duration = 300) {
  console.log(`[ADB] Swipe (${x1}, ${y1}) -> (${x2}, ${y2})`);
  adb(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
}

function screencap(name) {
  const localPath = path.join(__dirname, `${name}.png`);
  adb(`shell screencap -p /sdcard/${name}.png`);
  adb(`pull /sdcard/${name}.png "${localPath}"`);
  console.log(`[SCREEN] Saved ${localPath}`);
  return localPath;
}

async function main() {
  console.log('=== STARTING LIVE E2E SMOKE TEST ===');
  
  // 1. Reset logcat
  adb('logcat -c');

  // 2. Restart app
  console.log('[STEP 1] Restarting JobNest app...');
  adb('shell am force-stop com.anonymous.hyperlocalmobile');
  adb('shell am start -n com.anonymous.hyperlocalmobile/.MainActivity');
  await sleep(6000);
  screencap('live_step1_home');

  // 3. Tap "Categories" tab at bottom
  console.log('[STEP 2] Tapping Categories tab...');
  tap(380, 2280);
  await sleep(3000);
  screencap('live_step2_categories_list');

  // 4. Tap First Category ("Cleaning" or "Beauty Services")
  console.log('[STEP 3] Tapping Category...');
  tap(540, 600);
  await sleep(3000);
  screencap('live_step3_category_workers');

  // 5. Tap First Worker in Category
  console.log('[STEP 4] Tapping Worker Card...');
  tap(540, 700);
  await sleep(3000);
  screencap('live_step4_worker_profile');

  // 6. Tap "Book Service" at bottom of worker profile
  console.log('[STEP 5] Tapping Book Service...');
  tap(540, 2250);
  await sleep(3000);
  screencap('live_step5_booking_form');

  // 7. Scroll down to bottom of booking form
  console.log('[STEP 6] Scrolling down booking form...');
  swipe(540, 1800, 540, 600, 400);
  await sleep(1500);
  swipe(540, 1800, 540, 600, 400);
  await sleep(1500);
  screencap('live_step6_booking_form_bottom');

  // 8. Tap "Confirm Booking" (DIRECT RAZORPAY LAUNCH)
  console.log('[STEP 7] Tapping Confirm Booking (DIRECT RAZORPAY LAUNCH)...');
  tap(540, 2230);
  
  // Wait for booking creation + order creation + Razorpay checkout launch
  console.log('[STEP 6] Waiting for direct Razorpay checkout launch...');
  await sleep(6000);
  screencap('live_step5_razorpay_opened');

  // Check if Chrome opened Razorpay
  await sleep(3000);
  screencap('live_step6_razorpay_rendered');

  // Tap Netbanking in Razorpay modal
  console.log('[STEP 7] Selecting Netbanking in Razorpay modal...');
  tap(540, 1300);
  await sleep(2500);
  screencap('live_step7_netbanking_options');

  // Tap HDFC Bank
  console.log('[STEP 8] Selecting HDFC Bank...');
  tap(270, 1100);
  await sleep(2000);

  // Tap "Pay Now" in Razorpay modal
  console.log('[STEP 9] Tapping Pay Now in Razorpay modal...');
  tap(540, 2150);
  await sleep(4500);
  screencap('live_step8_bank_simulator');

  // On Razorpay Bank Simulator page:
  console.log('[STEP 10] Tapping Success on Bank Simulator...');
  tap(540, 1050);
  await sleep(3500);
  screencap('live_step9_post_simulator');

  // Check if Chrome prompts "Continue to Jobnest? [Continue]"
  console.log('[STEP 11] Tapping Continue on Chrome prompt if present...');
  tap(850, 280);
  await sleep(5000);
  screencap('live_step10_final_booking_details');

  // Dump logcat
  adb('logcat -d > final_payment_smoke_logcat.txt');
  console.log('=== TEST COMPLETED ===');
}

main().catch(console.error);
