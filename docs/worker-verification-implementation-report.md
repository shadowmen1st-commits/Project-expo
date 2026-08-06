# Worker Verification & KYC Onboarding Implementation Report

This report outlines the implementation details of the Worker KYC onboarding and verification workflow in the Hyperlocal Marketplace.

## 1. Lifecycle and Status Transitions
The verification workflow is designed as a strict state machine to guide workers from initial account registration to active listing and service delivery:

```
[ INCOMPLETE_PROFILE ] (Initial state)
        │
        ▼ (Updates personal details, uploads documents)
    [ DRAFT ]
        │
        ▼ (Accepts declarations, submits for approval)
[ PENDING_APPROVAL ]
        │
   ┌────┴──────────────────────────┐
   ▼ (Admin Approve)               ▼ (Admin Request Changes)
[ APPROVED ]                 [ CHANGES_REQUIRED ]
   │                               │
   ▼ (Admin Suspend)               ▼ (Re-upload/Fix details)
[ SUSPENDED ] ◄────────────────────┘
   │
   ▼ (Admin Restore)
[ APPROVED ]
```

### Detailed State Specifications:
* **INCOMPLETE_PROFILE**: The worker has created an account but has not yet filled out their professional details or uploaded the minimum required KYC documents (Aadhaar & PAN).
* **DRAFT**: Worker has provided basic professional details and uploaded some documents, but has not completed the final declaration and consent.
* **PENDING_APPROVAL**: The worker has signed the legal declaration and submitted their profile for admin review. Profile updates and document deletions/replacements are locked in this state.
* **CHANGES_REQUIRED**: An admin has reviewed the submission and found issues with one or more documents or profile details. The profile is unlocked for corrections.
* **APPROVED**: The profile is verified and active. The worker is awarded the Verification Badge, visible in customer search listings, and is authorized to accept bookings.
* **REJECTED**: The profile did not meet platform verification standards.
* **SUSPENDED**: An admin has temporarily deactivated a previously verified worker due to violations. The worker is immediately hidden from customer searches and blocked from accepting bookings.

## 2. API Endpoints
All endpoints are secured using role-based access control (RBAC) and authentication middlewares:

### Worker Endpoints (`/api/v1/worker/verification`):
* `PUT /profile` - Saves or updates basic personal information (name, address, date of birth). Enforces age >= 18.
* `PUT /professional-details` - Saves professional details (primary service category, bio, rate). Validates category eligibility.
* `POST /documents` - Uploads a KYC document (Aadhaar or PAN) as multipart form data.
* `DELETE /documents/:documentId` - Soft-deletes a document. Blocked if submission is pending approval.
* `POST /submit` - Performs validation checks on complete snapshot and submits for review.
* `POST /resubmit` - Re-submits corrected profile after changes are requested.
* `GET /` - Fetches the current verification dashboard state and document history.

### Admin Endpoints (`/api/v1/admin/worker-verifications`):
* `GET /` - Lists pending, active, and historical verification submissions.
* `POST /:submissionId/start-review` - Locks the submission for review by the assigning admin.
* `POST /:submissionId/documents/:documentId/approve` - Approves a specific document.
* `POST /:submissionId/documents/:documentId/reject` - Rejects a specific document with comments.
* `POST /:submissionId/approve` - Final approval of onboarding submission (sets status to `APPROVED`).
* `POST /:submissionId/reject` - Rejects onboarding submission (sets status to `REJECTED`).
* `POST /:submissionId/request-changes` - Reverts submission to worker with comments (sets status to `CHANGES_REQUIRED`).
* `POST /workers/:userId/suspend` - Suspends an approved worker profile.
* `POST /workers/:userId/restore` - Restores a suspended worker profile.

## 3. Security Boundaries
* **State Blocking**: Workers in `INCOMPLETE_PROFILE`, `DRAFT`, `PENDING_APPROVAL`, `CHANGES_REQUIRED`, or `SUSPENDED` states are strictly blocked from appearing in search results, accepting customer service requests, or initiating payouts.
* **Document Locking**: While a submission is in `PENDING_APPROVAL` status, any modification or deletion of KYC documents is blocked to prevent worker tampering during audits.
* **Access Control**: Public user profiles never expose sensitive KYC document metadata. Signed URLs for document downloads are restricted only to the owner worker and authorised admin users.
