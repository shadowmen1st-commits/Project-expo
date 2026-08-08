import { Router } from 'express';
import {
    getPendingWorkers, verifyWorker, viewDocumentDetails,
    createCategory, getCategories, deleteCategory, createCommissionRule, getCommissionRules,
    getAnalytics, getAuditLogs, getPayoutRequests, processPayout,
    getCompanies, verifyCompany, rejectCompany, suspendCompany, activateCompany,
    getCompanyJobsAdmin, getCompanyWorkersAdmin, getCompanyPaymentsAdmin,
    getCompanyVerificationAdmin, requestInfoCompanyVerification,
} from '../controllers/adminController.js';
import {
    listPayments, getPaymentDetail, reconcilePayment,
    listWebhookEvents, getWebhookEventDetail,
} from '../controllers/adminPaymentController.js';
import {
    getLedgerAccounts, getLedgerTransactions, reconcileWorkerWallet,
    reconcileAllWallets, reverseLedgerTransaction, postManualJournalEntry,
} from '../controllers/ledgerController.js';
import {
    listAdminPayoutAccounts, getAdminPayoutAccount, approveAdminPayoutAccount,
    rejectAdminPayoutAccount, revalidateAdminPayoutAccount, blockAdminPayoutAccount,
    listAdminPayouts, getAdminPayout, approveAdminPayout, rejectAdminPayout,
    processAdminPayout, cancelAdminPayout, reconcileAdminPayout,
    getAdminPayoutReconciliation, runAdminPayoutReconciliation, getAdminPayoutReconciliationIssues,
    repairAdminPayoutReconciliation,
} from '../controllers/payoutController.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import * as reviewController from '../controllers/reviewController.js';
import * as communications from '../controllers/adminCommunicationController.js';

const router = Router();
router.use(authMiddleware);

router.get('/chat-reports',requirePermission('chatReports.read'),communications.chatReports);router.get('/chat-reports/:reportId',requirePermission('chatReports.read'),communications.chatReportDetail);for(const [path,action] of [['start-review','start'],['resolve','resolve'],['reject','reject']])router.post(`/chat-reports/:reportId/${path}`,requirePermission('chatReports.resolve'),(req,_res,next)=>{req.reportAction=action;next()},communications.reportAction);for(const action of ['hide','restore'])router.post(`/messages/:messageId/${action}`,requirePermission('conversations.moderate'),(req,_res,next)=>{req.messageAction=action;next()},communications.moderateMessage);for(const action of ['restrict','unrestrict'])router.post(`/conversations/:conversationId/${action}`,requirePermission('communicationRestrictions.manage'),(req,_res,next)=>{req.restrictionAction=action;next()},communications.adminRestriction);
router.get('/support/tickets',requirePermission('support.read'),communications.supportList);router.get('/support/tickets/:ticketId',requirePermission('support.read'),communications.supportDetail);router.post('/support/tickets/:ticketId/reply',requirePermission('support.reply'),communications.supportReply);router.post('/support/tickets/:ticketId/internal-note',requirePermission('support.internalNotes'),(req,_res,next)=>{req.internalNote=true;next()},communications.supportReply);router.post('/support/tickets/:ticketId/assign',requirePermission('support.assign'),communications.assignTicket);for(const [path,target,permission] of [['triage','TRIAGED','support.assign'],['request-user-response','WAITING_FOR_USER','support.reply'],['resolve','RESOLVED','support.resolve'],['close','CLOSED','support.resolve'],['reopen','REOPENED','support.resolve'],['mark-spam','SPAM','support.resolve']])router.post(`/support/tickets/:ticketId/${path}`,requirePermission(permission),(req,_res,next)=>{req.ticketTarget=target;next()},communications.transitionTicket);router.post('/support/tickets/:ticketId/escalate',requirePermission('support.escalate'),communications.escalateTicket);router.post('/support/sla/scan',requirePermission('support.escalate'),communications.scanSla);

router.get('/reviews', requirePermission('reviews.read'), reviewController.adminList);
router.get('/reviews/:id', requirePermission('reviews.read'), reviewController.adminGet);
for (const [path, action, permission] of [['start-review','START_REVIEW','reviews.moderate'],['approve','APPROVE','reviews.moderate'],['hide','HIDE','reviews.moderate'],['remove','REMOVE','reviews.remove'],['restore','RESTORE','reviews.restore']]) router.post(`/reviews/:id/${path}`, requirePermission(permission), (req,_res,next)=>{req.reviewAction=action;next();}, reviewController.moderate);
router.get('/review-reports', requirePermission('reviewReports.read'), reviewController.reports);
router.get('/review-reports/:id', requirePermission('reviewReports.read'), reviewController.reportGet);
router.post('/review-reports/:id/resolve', requirePermission('reviewReports.resolve'), reviewController.reportResolve);
router.post('/review-reports/:id/reject', requirePermission('reviewReports.resolve'), (req,_res,next)=>{req.reportReject=true;next();}, reviewController.reportResolve);
router.get('/review-reconciliation', requirePermission('reviews.read'), reviewController.reconcile);
router.post('/review-reconciliation/run', requirePermission('reviews.read'), reviewController.reconcile);
router.post('/review-reconciliation/rebuild/:workerId', requirePermission('reviews.moderate'), reviewController.rebuild);

// ── Workers & Documents Verification ──────────────────────────────────────────
router.get('/workers/pending', requirePermission('documents.review'), getPendingWorkers);
router.post('/workers/verify/:id', requirePermission('workers.approve'), verifyWorker);
router.get('/documents/view/:docId', requirePermission('documents.review'), viewDocumentDetails);

// ── Categories & Commission ────────────────────────────────────────────────────
router.post('/categories', requirePermission('categories.manage'), createCategory);
router.get('/categories/all', getCategories);
router.delete('/categories/:id', requirePermission('categories.manage'), deleteCategory);
router.post('/commissions', requirePermission('commissions.manage'), createCommissionRule);
router.get('/commissions', requirePermission('commissions.manage'), getCommissionRules);

// ── Payout processing ──────────────────────────────────────────────────────────

// ── Analytics & Logs ───────────────────────────────────────────────────────────
router.get('/analytics', requirePermission('reports.read'), getAnalytics);
router.get('/audit-logs', requirePermission('audit_logs.read'), getAuditLogs);

// ── Payment Management ─────────────────────────────────────────────────────────
// Read payment orders
router.get('/payments', requirePermission('payments.read'), listPayments);
router.get('/payments/:paymentId', requirePermission('payments.read'), getPaymentDetail);
// Provider-backed reconciliation (requires payments.manage — cannot force success)
router.post('/payments/:paymentId/reconcile', requirePermission('payments.manage'), reconcilePayment);

// ── Webhook Event Log ──────────────────────────────────────────────────────────
router.get('/webhook-events', requirePermission('payments.read'), listWebhookEvents);
router.get('/webhook-events/:eventId', requirePermission('payments.read'), getWebhookEventDetail);

// ── Payout Administration ───────────────────────────────────────────────────
router.get('/payout-accounts', requirePermission('payouts.review'), listAdminPayoutAccounts);
router.get('/payout-accounts/:id', requirePermission('payouts.review'), getAdminPayoutAccount);
router.post('/payout-accounts/:id/approve', requirePermission('payouts.approve'), approveAdminPayoutAccount);
router.post('/payout-accounts/:id/reject', requirePermission('payouts.approve'), rejectAdminPayoutAccount);
router.post('/payout-accounts/:id/revalidate', requirePermission('payouts.review'), revalidateAdminPayoutAccount);
router.post('/payout-accounts/:id/block', requirePermission('payouts.approve'), blockAdminPayoutAccount);
router.get('/payouts', requirePermission('payouts.read'), listAdminPayouts);
router.get('/payouts/:id', requirePermission('payouts.read'), getAdminPayout);
router.post('/payouts/:id/approve', requirePermission('payouts.approve'), approveAdminPayout);
router.post('/payouts/:id/reject', requirePermission('payouts.approve'), rejectAdminPayout);
router.post('/payouts/:id/process', requirePermission('payouts.process'), processAdminPayout);
router.post('/payouts/:id/cancel', requirePermission('payouts.process'), cancelAdminPayout);
router.post('/payouts/:id/reconcile', requirePermission('payouts.reconcile'), reconcileAdminPayout);
router.get('/payout-reconciliation', requirePermission('payouts.reconcile'), getAdminPayoutReconciliation);
router.post('/payout-reconciliation/run', requirePermission('payouts.reconcile'), runAdminPayoutReconciliation);
router.get('/payout-reconciliation/issues', requirePermission('payouts.reconcile'), getAdminPayoutReconciliationIssues);
router.post('/payout-reconciliation/:id/repair', requirePermission('payouts.reconcile'), repairAdminPayoutReconciliation);

// ── Ledger Management ──────────────────────────────────────────────────────────
router.get('/ledger/accounts', requirePermission('payments.read'), getLedgerAccounts);
router.get('/ledger/transactions', requirePermission('payments.read'), getLedgerTransactions);
router.post('/ledger/reconcile/:workerId', requirePermission('payments.manage'), reconcileWorkerWallet);
router.post('/ledger/reconcile-all', requirePermission('payments.manage'), reconcileAllWallets);
router.post('/ledger/reverse/:transactionId', requirePermission('payments.manage'), reverseLedgerTransaction);
router.post('/ledger/manual', requirePermission('payments.manage'), postManualJournalEntry);

// ── Company Administration ───────────────────────────────────────────────────
router.get('/companies', requirePermission('users.read'), getCompanies);
router.get('/companies/:id/verification', requirePermission('users.read'), getCompanyVerificationAdmin);
router.patch('/companies/:id/verification/approve', requirePermission('users.manage'), verifyCompany);
router.patch('/companies/:id/verification/request-information', requirePermission('users.manage'), requestInfoCompanyVerification);
router.patch('/companies/:id/verification/reject', requirePermission('users.manage'), rejectCompany);
router.patch('/companies/:id/suspend', requirePermission('users.manage'), suspendCompany);
router.post('/companies/:id/activate', requirePermission('users.manage'), activateCompany);
router.get('/companies/:id/jobs', requirePermission('users.read'), getCompanyJobsAdmin);
router.get('/companies/:id/workers', requirePermission('users.read'), getCompanyWorkersAdmin);
router.get('/companies/:id/payments', requirePermission('users.read'), getCompanyPaymentsAdmin);

export default router;
