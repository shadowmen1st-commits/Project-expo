import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
process.env.NODE_ENV='test'; process.env.PAYMENT_PROVIDER_MODE='mock'; process.env.PAYOUT_PROVIDER='mock'; process.env.PAYOUT_PROVIDER_MODE='mock'; process.env.PAYOUT_DATA_ENCRYPTION_KEY='0123456789abcdef0123456789abcdef'; process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION='v1'; process.env.MONGODB_URI='mongodb://unused/test';

const { default: mongoose } = await import('mongoose');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: User } = await import('../src/models/User.js');
const { default: WorkerProfile } = await import('../src/models/WorkerProfile.js');
const { default: WorkerWallet } = await import('../src/models/WorkerWallet.js');
const { default: WorkerPayoutAccount } = await import('../src/models/WorkerPayoutAccount.js');
const { default: WorkerPayout } = await import('../src/models/WorkerPayout.js');
const { default: PayoutPolicy } = await import('../src/models/PayoutPolicy.js');
const { default: LedgerTransaction } = await import('../src/models/LedgerTransaction.js');
const { default: LedgerEntry } = await import('../src/models/LedgerEntry.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { default: Notification } = await import('../src/models/Notification.js');
const { default: WebhookEvent } = await import('../src/models/WebhookEvent.js');
const { default: DisputeCase } = await import('../src/models/DisputeCase.js');
const { default: LedgerPostingService } = await import('../src/services/payments/LedgerPostingService.js');
const { default: EncryptionService } = await import('../src/services/payments/EncryptionService.js');
const { default: PayoutAccountService } = await import('../src/services/payments/PayoutAccountService.js');
const { default: Eligibility } = await import('../src/services/payments/WithdrawalEligibilityService.js');
const { default: Reservation } = await import('../src/services/payments/PayoutReservationService.js');
const { default: Processing } = await import('../src/services/payments/PayoutProcessingService.js');
const { default: Webhooks } = await import('../src/services/payments/PayoutWebhookService.js');
const { default: State } = await import('../src/services/payments/PayoutStateService.js');
const { default: Reconciliation } = await import('../src/services/payments/PayoutReconciliationService.js');

let passed=0, failed=0; const failures=[];
async function test(name, fn){ try { await fn(); passed++; console.log(`PASS ${name}`); } catch(e){ failed++; failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); } }
const hasReason = async (args, reason) => assert.ok((await Eligibility.evaluate(args)).reasons.includes(reason));
const signBody = (body) => Webhooks.sign(body, 'payout-secret');
const eventBody = (id, payout, status, overrides={}) => Buffer.from(JSON.stringify({ id, event:`payout.${status}`, payload:{ payout:{ entity:{ id:payout.providerPayoutId, amount:payout.amountPaise, currency:payout.currency, status, ...overrides } } } }));

async function main(){
 await connectDB();
 const admin=await User.create({name:'Admin',email:'admin-pay@test.com',passwordHash:'pw',role:'ADMIN',phone:'9000000000'});
 const worker=await User.create({name:'Worker',email:'worker-pay@test.com',passwordHash:'pw',role:'WORKER',phone:'9000000001'});
 const other=await User.create({name:'Other',email:'other-pay@test.com',passwordHash:'pw',role:'WORKER',phone:'9000000002'});
 const profile=await WorkerProfile.create({userId:worker._id,verificationStatus:'APPROVED'}); await WorkerProfile.create({userId:other._id,verificationStatus:'APPROVED'});
 await PayoutPolicy.create({minimumPayoutPaise:10000,maximumPayoutPaise:500000,dailyPayoutLimitPaise:2000000,monthlyPayoutLimitPaise:5000000,maximumDailyRequests:20,manualReviewThresholdPaise:200000,supportedModes:['IMPS','UPI'],payoutAccountValidationRequired:true,KycRequired:true,coolDownMinutes:0,isActive:true,effectiveFrom:new Date(),createdBy:'SYSTEM',updatedBy:'SYSTEM'});
 await LedgerPostingService.postTransaction({transactionType:'TEST_EARNING',businessEvent:'TEST_EARNING',workerId:worker._id,idempotencyKey:'SEED:PAYOUT',entries:[{code:'WORKER_EARNINGS_AVAILABLE',ownerType:'WORKER',ownerId:worker._id,direction:'CREDIT',amountPaise:1000000},{code:'WORKER_EARNINGS_PENDING',ownerType:'WORKER',ownerId:worker._id,direction:'DEBIT',amountPaise:1000000}]});

 const enc1=EncryptionService.encryptValue('123456789012'); const enc2=EncryptionService.encryptValue('123456789012');
 await test('AES-GCM encryption round-trip',()=>assert.equal(EncryptionService.decryptValue(enc1.value,enc1.keyVersion),'123456789012'));
 await test('identical plaintext uses different IV',()=>assert.notEqual(enc1.value.split(':')[0],enc2.value.split(':')[0]));
 await test('ciphertext is not plaintext',()=>assert.ok(!enc1.value.includes('123456789012')));
 await test('authentication tag is stored',()=>assert.equal(enc1.value.split(':')[2].length,32));
 await test('key version is stored',()=>assert.equal(enc1.value.split(':')[3],'v1'));
 await test('ciphertext tampering fails',()=>{const p=enc1.value.split(':');p[1]=(p[1][0]==='a'?'b':'a')+p[1].slice(1);assert.throws(()=>EncryptionService.decryptValue(p.join(':'),'v1'));});
 await test('authentication tag tampering fails',()=>{const p=enc1.value.split(':');p[2]=(p[2][0]==='a'?'b':'a')+p[2].slice(1);assert.throws(()=>EncryptionService.decryptValue(p.join(':'),'v1'));});
 await test('wrong key version fails',()=>assert.throws(()=>EncryptionService.decryptValue(enc1.value,'v2')));
 await test('invalid encrypted format fails',()=>assert.throws(()=>EncryptionService.decryptValue('bad','v1')));
 await test('configured encryption key accepted',()=>assert.equal(EncryptionService.assertConfigured(),true));
 await test('production startup rejects missing payout encryption key',()=>{const env={...process.env,NODE_ENV:'production',PAYOUT_DATA_ENCRYPTION_KEY:'',PAYOUT_PROVIDER:'razorpayx',PAYOUT_PROVIDER_MODE:'live',PAYMENT_PROVIDER_MODE:'live',MONGODB_URI:'mongodb://unused/prod',CUSTOMER_APP_URL:'http://localhost',WEB_ADMIN_URL:'http://localhost',JWT_ACCESS_SECRET:'x',JWT_REFRESH_SECRET:'y',RAZORPAY_KEY_ID:'x',RAZORPAY_KEY_SECRET:'y',RAZORPAY_WEBHOOK_SECRET:'z'};const run=spawnSync(process.execPath,['--input-type=module','-e',"import './src/config/env.js'"],{cwd:process.cwd(),env,encoding:'utf8'});assert.notEqual(run.status,0);assert.ok(!`${run.stdout}${run.stderr}`.includes('0123456789abcdef'));});

 const bank=await PayoutAccountService.createAccount({workerId:worker._id,accountType:'BANK_ACCOUNT',displayName:'Salary',beneficiaryName:'Worker',accountNumber:'123456789012',ifsc:'ABCD0001234',bankName:'Bank',provider:'mock'});
 const vpa=await PayoutAccountService.createAccount({workerId:worker._id,accountType:'VPA',displayName:'UPI',beneficiaryName:'Worker',vpa:'worker@upi',provider:'mock'});
 await WorkerPayoutAccount.updateMany({_id:{$in:[bank._id,vpa._id]}},{verificationStatus:'VERIFIED',validationStatus:'VALID'}); const bankFresh=await WorkerPayoutAccount.findById(bank._id); const dto=await PayoutAccountService.toSafeDto(bankFresh); const vpaDto=await PayoutAccountService.toSafeDto(await WorkerPayoutAccount.findById(vpa._id));
 await test('bank number encrypted at rest',()=>assert.notEqual(bankFresh.encryptedAccountNumber,'123456789012'));
 await test('VPA encrypted at rest',()=>assert.ok(vpa.encryptedVpa&&!vpa.encryptedVpa.includes('worker@upi')));
 await test('DTO exposes last four only',()=>assert.equal(dto.accountNumberLast4,'9012'));
 await test('DTO omits encrypted account number',()=>assert.equal(dto.encryptedAccountNumber,undefined));
 await test('DTO omits encrypted IFSC',()=>assert.equal(dto.encryptedIfsc,undefined));
 await test('DTO omits encryption key version',()=>assert.equal(dto.encryptionKeyVersion,undefined));
 await test('DTO masks IFSC',()=>assert.equal(dto.ifscMasked,'ABCDXXXX34'));
 await test('DTO masks VPA',()=>assert.ok(vpaDto.vpaMasked.includes('***')));
 await test('DTO omits encrypted VPA',()=>assert.equal(vpaDto.encryptedVpa,undefined));
 await test('audit snapshot contains no bank number',async()=>assert.ok(!(JSON.stringify(await AuditLog.find({resourceId:bank._id.toString()}).lean())).includes('123456789012')));

 const base={workerId:worker._id,amountPaise:20000,payoutAccountId:bank._id,currency:'INR'};
 await test('eligible verified worker succeeds',async()=>assert.equal((await Eligibility.evaluate(base)).allowed,true));
 await test('decimal amount rejected',()=>hasReason({...base,amountPaise:10000.5},'INVALID_AMOUNT'));
 await test('negative amount rejected',()=>hasReason({...base,amountPaise:-1},'INVALID_AMOUNT'));
 await test('unsafe integer rejected',()=>hasReason({...base,amountPaise:Number.MAX_SAFE_INTEGER+1},'INVALID_AMOUNT'));
 await test('invalid currency rejected',()=>hasReason({...base,currency:'USD'},'INVALID_CURRENCY'));
 await test('below minimum rejected',()=>hasReason({...base,amountPaise:9999},'BELOW_MINIMUM'));
 await test('above maximum rejected',()=>hasReason({...base,amountPaise:500001},'ABOVE_MAXIMUM'));
 await test('above available rejected',()=>hasReason({...base,amountPaise:5000000},'INSUFFICIENT_AVAILABLE_BALANCE'));
 await WorkerPayoutAccount.findByIdAndUpdate(bank._id,{verificationStatus:'UNDER_REVIEW'}); await test('unverified account rejected',()=>hasReason(base,'PAYOUT_ACCOUNT_UNVERIFIED')); await WorkerPayoutAccount.findByIdAndUpdate(bank._id,{verificationStatus:'VERIFIED'});
 await WorkerPayoutAccount.findByIdAndUpdate(bank._id,{status:'DISABLED'}); await test('disabled account rejected',()=>hasReason(base,'PAYOUT_ACCOUNT_DISABLED')); await WorkerPayoutAccount.findByIdAndUpdate(bank._id,{status:'ACTIVE'});
 await test('another worker account rejected',()=>hasReason({...base,workerId:other._id},'PAYOUT_ACCOUNT_NOT_OWNED'));
 await WorkerProfile.findByIdAndUpdate(profile._id,{verificationStatus:'SUSPENDED'}); await test('suspended worker rejected',()=>hasReason(base,'KYC_REQUIRED')); await WorkerProfile.findByIdAndUpdate(profile._id,{verificationStatus:'BLOCKED'}); await test('blocked worker rejected',()=>hasReason(base,'KYC_REQUIRED')); await WorkerProfile.findByIdAndUpdate(profile._id,{verificationStatus:'APPROVED'});
 await DisputeCase.insertMany([{disputeNumber:'DSP-PAYOUT',bookingId:new mongoose.Types.ObjectId(),customerId:new mongoose.Types.ObjectId(),workerId:worker._id,openedByType:'WORKER',openedById:worker._id,disputeType:'OTHER',reasonCode:'TEST',title:'Test dispute',description:'Test active dispute',claimedAmountPaise:10000,status:'OPEN',currency:'INR'}]); await test('active dispute rejected',()=>hasReason(base,'ACTIVE_DISPUTE')); await DisputeCase.deleteMany({});
 await PayoutPolicy.findOneAndUpdate({isActive:true},{dailyPayoutLimitPaise:15000}); await test('daily limit rejected',()=>hasReason(base,'DAILY_LIMIT_EXCEEDED')); await PayoutPolicy.findOneAndUpdate({isActive:true},{dailyPayoutLimitPaise:2000000,monthlyPayoutLimitPaise:15000}); await test('monthly limit rejected',()=>hasReason(base,'MONTHLY_LIMIT_EXCEEDED')); await PayoutPolicy.findOneAndUpdate({isActive:true},{monthlyPayoutLimitPaise:5000000});

 const rollback=await Reservation.createWithdrawalRequest({...base,idempotencyKey:'rollback'}); const txBefore=await LedgerTransaction.countDocuments(); const entriesBefore=await LedgerEntry.countDocuments(); const walletBefore=await WorkerWallet.findOne({workerId:worker._id}).lean();
 await test('injected post-ledger failure aborts transaction',async()=>await assert.rejects(Reservation.reserveFunds(rollback,{failAfter:'ledger'}),/could not be completed/));
 await test('rollback leaves no ledger transaction',async()=>assert.equal(await LedgerTransaction.countDocuments(),txBefore));
 await test('rollback leaves no ledger entries',async()=>assert.equal(await LedgerEntry.countDocuments(),entriesBefore));
 await test('rollback restores payout status',async()=>assert.equal((await WorkerPayout.findById(rollback._id)).status,'REQUESTED'));
 await test('rollback leaves wallet projection unchanged',async()=>assert.deepEqual((await WorkerWallet.findOne({workerId:worker._id})).availableBalancePaise,walletBefore.availableBalancePaise));
 await test('rollback leaves no success audit',async()=>assert.equal(await AuditLog.countDocuments({resourceId:rollback._id.toString(),action:'PAYOUT_RESERVED'}),0));

 await PayoutPolicy.findOneAndUpdate({isActive:true},{maximumPayoutPaise:800000,dailyPayoutLimitPaise:5000000,monthlyPayoutLimitPaise:10000000}); const a=await Reservation.createWithdrawalRequest({...base,amountPaise:700000,idempotencyKey:'concurrent-a'}); const b=await Reservation.createWithdrawalRequest({...base,amountPaise:700000,idempotencyKey:'concurrent-b'}); const results=await Promise.allSettled([Reservation.reserveFunds(a),Reservation.reserveFunds(b)]); const successful=results.filter(r=>r.status==='fulfilled'&&r.value?.success);
 await test('concurrent over-reservation permits only one',()=>assert.equal(successful.length,1));
 await test('available balance never negative',async()=>assert.ok((await WorkerWallet.findOne({workerId:worker._id})).availableBalancePaise>=0));
 await test('reserved balance never exceeds funding',async()=>assert.ok((await WorkerWallet.findOne({workerId:worker._id})).reservedBalancePaise<=1000000));
 await test('only one concurrent reservation journal posted',async()=>assert.equal(await LedgerTransaction.countDocuments({idempotencyKey:{$in:[`PAYOUT_RESERVE:${a._id}`,`PAYOUT_RESERVE:${b._id}`]}}),1));
 const same=await Promise.all([Reservation.createWithdrawalRequest({...base,idempotencyKey:'same-key'}),Reservation.createWithdrawalRequest({...base,idempotencyKey:'same-key'})]); await test('concurrent same idempotency key returns one payout',()=>assert.equal(same[0]._id.toString(),same[1]._id.toString()));
 await test('same key changed amount conflicts',async()=>await assert.rejects(Reservation.createWithdrawalRequest({...base,amountPaise:30000,idempotencyKey:'same-key'}),e=>e.errorCode==='IDEMPOTENCY_CONFLICT'));
 await test('client idempotency key stored only namespaced',()=>assert.equal(same[0].idempotencyKey,`PAYOUT_REQ:${worker._id}:same-key`));

 const reserved=successful[0].value.payout; const processedSubmission=await Processing.processPayout(reserved,{actorId:admin._id});
 await test('provider submission succeeds in test mock mode',()=>assert.equal(processedSubmission.success,true));
 await test('stable provider idempotency key stored',()=>assert.equal(processedSubmission.payout.providerIdempotencyKey,`PAYOUT_PROVIDER:${reserved._id}`));
 const retry=await Processing.processPayout(reserved,{actorId:admin._id}); await test('provider retry does not create new payout',()=>assert.equal(retry.payout.providerPayoutId,processedSubmission.payout.providerPayoutId));
 await test('provider payout ID is present',()=>assert.ok(processedSubmission.payout.providerPayoutId));
 await test('processing notification deduplicated',async()=>assert.equal(await Notification.countDocuments({idempotencyKey:`payout-processing-${reserved._id}`}),1));

 const goodBody=eventBody('evt-pending',processedSubmission.payout,'pending'); const goodSig=signBody(goodBody);
 await test('valid exact raw webhook passes',async()=>assert.equal((await Webhooks.handleWebhook({rawBody:goodBody,signature:goodSig,serverSecret:'payout-secret'})).accepted,true));
 await test('modified webhook body fails',async()=>assert.equal((await Webhooks.handleWebhook({rawBody:Buffer.concat([goodBody,Buffer.from(' ')]),signature:goodSig,serverSecret:'payout-secret'})).reason,'INVALID_SIGNATURE'));
 await test('whitespace change fails signature',async()=>{const body=Buffer.from(goodBody.toString().replace('{','{ '));assert.equal((await Webhooks.handleWebhook({rawBody:body,signature:goodSig,serverSecret:'payout-secret'})).reason,'INVALID_SIGNATURE');});
 await test('missing signature fails',async()=>assert.equal((await Webhooks.handleWebhook({rawBody:goodBody,serverSecret:'payout-secret'})).reason,'SIGNATURE_REQUIRED'));
 await test('invalid signature fails',async()=>assert.equal((await Webhooks.handleWebhook({rawBody:goodBody,signature:'bad',serverSecret:'payout-secret'})).reason,'INVALID_SIGNATURE'));
 await test('oversized webhook fails',async()=>{const body=Buffer.alloc(11);assert.equal((await Webhooks.handleWebhook({rawBody:body,signature:signBody(body),serverSecret:'payout-secret',maxBytes:10})).reason,'PAYLOAD_TOO_LARGE');});
 await test('malformed signed JSON handled safely',async()=>{const body=Buffer.from('{bad');assert.equal((await Webhooks.handleWebhook({rawBody:body,signature:signBody(body),serverSecret:'payout-secret'})).reason,'MALFORMED_JSON');});
 await test('duplicate webhook is accepted and deduplicated',async()=>assert.equal((await Webhooks.handleWebhook({rawBody:goodBody,signature:goodSig,serverSecret:'payout-secret'})).deduplicated,true));
 await test('signature itself is not stored',async()=>assert.equal(await WebhookEvent.countDocuments({signatureHash:goodSig}),0));
 await test('pending does not increase total withdrawn',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).totalWithdrawnPaise,0));

 const doneBody=eventBody('evt-processed',processedSubmission.payout,'processed'); const done=await Webhooks.handleWebhook({rawBody:doneBody,signature:signBody(doneBody),serverSecret:'payout-secret'});
 await test('processed webhook applies terminal state',()=>assert.equal(done.result.success,true));
 await test('processed payout status persisted',async()=>assert.equal((await WorkerPayout.findById(reserved._id)).status,'PROCESSED'));
 await test('processed ledger uses deterministic key',async()=>assert.equal(await LedgerTransaction.countDocuments({idempotencyKey:`PAYOUT_PROCESSED:${processedSubmission.payout.providerPayoutId}`}),1));
 await test('processed journal is balanced',async()=>{const tx=await LedgerTransaction.findOne({idempotencyKey:`PAYOUT_PROCESSED:${processedSubmission.payout.providerPayoutId}`});assert.equal(tx.totalDebitPaise,tx.totalCreditPaise);});
 await test('processed reduces reserved balance',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).reservedBalancePaise,0));
 await test('processed increases total withdrawn',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).totalWithdrawnPaise,700000));
 const duplicateDone=await Webhooks.handleWebhook({rawBody:doneBody,signature:signBody(doneBody),serverSecret:'payout-secret'}); await test('duplicate processed webhook deduplicates',()=>assert.equal(duplicateDone.deduplicated,true));
 await test('processed notification emitted once',async()=>assert.equal(await Notification.countDocuments({idempotencyKey:`payout-processed-${reserved._id}`}),1));

 const revBody=eventBody('evt-reversed',processedSubmission.payout,'reversed'); const rev=await Webhooks.handleWebhook({rawBody:revBody,signature:signBody(revBody),serverSecret:'payout-secret'});
 await test('reversal applies once',()=>assert.equal(rev.result.success,true));
 await test('reversal restores available entitlement',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).availableBalancePaise,1000000));
 await test('reversal decrements withdrawn total',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).totalWithdrawnPaise,0));
 await test('reversal references processed journal',async()=>{const p=await WorkerPayout.findById(reserved._id);const tx=await LedgerTransaction.findById(p.ledgerReversalTransactionId);assert.equal(tx.reversalOfTransactionId.toString(),p.ledgerProcessedTransactionId.toString());});
 await test('duplicate reversal is idempotent',async()=>assert.equal((await Webhooks.handleWebhook({rawBody:revBody,signature:signBody(revBody),serverSecret:'payout-secret'})).deduplicated,true));

 const failureRequest=await Reservation.createWithdrawalRequest({...base,amountPaise:100000,idempotencyKey:'failure-case'}); const failureReserved=(await Reservation.reserveFunds(failureRequest)).payout; const failureSubmitted=(await Processing.processPayout(failureReserved,{actorId:admin._id})).payout; const failBody=eventBody('evt-failed',failureSubmitted,'failed',{failure_reason:'Bank rejected destination'}); await Webhooks.handleWebhook({rawBody:failBody,signature:signBody(failBody),serverSecret:'payout-secret'});
 await test('provider failure sets FAILED',async()=>assert.equal((await WorkerPayout.findById(failureRequest._id)).status,'FAILED'));
 await test('failure restores available funds exactly once',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).availableBalancePaise,1000000));
 await test('failure does not increase withdrawn total',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).totalWithdrawnPaise,0));
 await test('failure release journal is deterministic',async()=>assert.equal(await LedgerTransaction.countDocuments({idempotencyKey:`PAYOUT_FAILED:${failureSubmitted.providerPayoutId}`}),1));
 await test('failure reason is stored safely',async()=>assert.equal((await WorkerPayout.findById(failureRequest._id)).failureDescriptionSafe,'Bank rejected destination'));
 await test('duplicate failure does not restore twice',async()=>{await Webhooks.handleWebhook({rawBody:failBody,signature:signBody(failBody),serverSecret:'payout-secret'});assert.equal((await WorkerWallet.findOne({workerId:worker._id})).availableBalancePaise,1000000);});

 const cancelRequest=await Reservation.createWithdrawalRequest({...base,amountPaise:100000,idempotencyKey:'cancel-case'}); const cancelReserved=(await Reservation.reserveFunds(cancelRequest)).payout; const cancelSubmitted=(await Processing.processPayout(cancelReserved,{actorId:admin._id})).payout; const queuedBody=eventBody('evt-queued',cancelSubmitted,'queued'); await Webhooks.handleWebhook({rawBody:queuedBody,signature:signBody(queuedBody),serverSecret:'payout-secret'}); const cancelBody=eventBody('evt-cancelled',cancelSubmitted,'cancelled'); await Webhooks.handleWebhook({rawBody:cancelBody,signature:signBody(cancelBody),serverSecret:'payout-secret'});
 await test('verified queued cancellation succeeds',async()=>assert.equal((await WorkerPayout.findById(cancelRequest._id)).status,'CANCELLED'));
 await test('cancellation restores reserved funds',async()=>assert.equal((await WorkerWallet.findOne({workerId:worker._id})).availableBalancePaise,1000000));
 await test('cancellation journal is balanced',async()=>{const tx=await LedgerTransaction.findOne({idempotencyKey:`PAYOUT_CANCELLED:${cancelSubmitted.providerPayoutId}`});assert.equal(tx.totalDebitPaise,tx.totalCreditPaise);});
 await test('local cancellation without provider verification fails',async()=>{const result=await State.transition(failureSubmitted,'CANCELLED',{});assert.equal(result.success,false);});
 const concurrentBody=Buffer.from(JSON.stringify({id:'evt-concurrent-duplicate',event:'payout.unknown',payload:{payout:{entity:{id:'unknown',status:'unknown'}}}})); const concurrentSig=signBody(concurrentBody); const concurrentHooks=await Promise.all([Webhooks.handleWebhook({rawBody:concurrentBody,signature:concurrentSig,serverSecret:'payout-secret'}),Webhooks.handleWebhook({rawBody:concurrentBody,signature:concurrentSig,serverSecret:'payout-secret'})]);
 await test('concurrent duplicate webhook processes once',()=>assert.equal(concurrentHooks.filter(r=>r.deduplicated).length,1));

 const recon=await Reconciliation.runReconciliation();
 await test('reconciliation is read-only',()=>assert.equal(recon.readOnly,true));
 await test('reconciliation includes payout count',()=>assert.ok(recon.summary.payoutCount>=1));
 await test('reconciliation finds no issue for hardened reversed payout',()=>assert.ok(!recon.issues.some(i=>i.payoutId===reserved._id.toString())));
 await test('safe payout DTO omits platform ledger IDs',()=>{const json=JSON.stringify(dto);assert.ok(!json.includes('ledgerReservationTransactionId'));});

 console.log(`PAYOUT_SECURITY_TOTAL=${passed+failed}`); console.log(`PAYOUT_SECURITY_PASSED=${passed}`); console.log(`PAYOUT_SECURITY_FAILED=${failed}`); if(failures.length) throw new Error(failures.join('\n'));
 await disconnectDB();
}
main().catch(async e=>{console.error(e);try{await disconnectDB();}catch{}process.exit(1);});
