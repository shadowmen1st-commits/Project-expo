# Admin Verification & Audit Workflow Guide

This document serves as an operational guide for platform administrators conducting KYC reviews and managing worker verification lifecycles.

## 1. Initiating the Review Process
When a worker submits their verification, it enters the `PENDING_APPROVAL` queue. An admin must claim the review session before making choices:

```
[ Worker Submits ] ──► [ Queue: PENDING_APPROVAL ]
                              │
                              ▼ (Admin calls /start-review)
                       [ Status: UNDER_REVIEW ] (Locked to Admin)
```

* **Mutual Exclusion (Locking)**: To prevent concurrent admin audits on the same worker, calling `POST /api/v1/admin/worker-verifications/:submissionId/start-review` sets the submission's status to `UNDER_REVIEW` and registers the `reviewedBy` field to the claiming admin.
* **Timeout Safeguard**: If no action is taken within 30 minutes, the review session lock is automatically released, and the submission status reverts back to `PENDING_APPROVAL` for other admins to claim.

## 2. Document Audit & Evaluation
For each uploaded document, the admin must review the uploaded image file and issue an individual decision:

### Approving a Document:
* **API Endpoint**: `POST /api/v1/admin/worker-verifications/:submissionId/documents/:documentId/approve`
* **Result**: Sets the individual document's status to `APPROVED` and records `verifiedAt` and `verifiedBy`.

### Rejecting a Document:
* **API Endpoint**: `POST /api/v1/admin/worker-verifications/:submissionId/documents/:documentId/reject`
* **Requirements**: Must supply a `rejectionReason` string (e.g., "Aadhaar photo is blurry").
* **Result**: Sets the individual document's status to `REJECTED` and records the audit comment.

## 3. Final Verification Decisions
Once all documents have been evaluated, the admin issues a final workflow decision:

### Scenario A: Approve Onboarding
* **Condition**: ALL required documents must be marked `APPROVED`.
* **API Endpoint**: `POST /api/v1/admin/worker-verifications/:submissionId/approve`
* **Result**: The worker profile status updates to `APPROVED`. They receive their Verification Badge, their profile is marked publicly visible, and they are allowed to accept bookings and payouts.

### Scenario B: Request Changes
* **Condition**: One or more documents were marked `REJECTED`.
* **API Endpoint**: `POST /api/v1/admin/worker-verifications/:submissionId/request-changes`
* **Requirements**: Must provide a `comment` describing the required fixes.
* **Result**: The worker profile verification status changes to `CHANGES_REQUIRED`. The worker dashboard unlocks for re-uploads.

### Scenario C: Reject Submission
* **Condition**: Serious fraud or invalid credentials detected.
* **API Endpoint**: `POST /api/v1/admin/worker-verifications/:submissionId/reject`
* **Result**: The profile is marked `REJECTED`, disabling onboarding.

## 4. Account Actions
* **Suspension (`POST /workers/:userId/suspend`)**: Enforces suspension of service delivery. The worker is immediately hidden from customer searches and blocked from accepting bookings. Reason is stored in `suspensionReason`.
* **Restoration (`POST /workers/:userId/restore`)**: Restores an account back to `APPROVED`.

## 5. Audit Trail and Logging
Every event is securely recorded in the platform `AuditLog` collection:
* **Actor**: The ID of the performing admin.
* **Action**: `ADMIN_REVIEW_START`, `ADMIN_DOCUMENT_APPROVE`, `ADMIN_DOCUMENT_REJECT`, `ADMIN_FINAL_APPROVE`, `ADMIN_SUSPEND`, or `ADMIN_RESTORE`.
* **Resource Type & ID**: Links directly to the `WorkerProfile` or `VerificationDocument`.
* **Request Context**: Logs IP Address and User Agent for auditability.
