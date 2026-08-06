# MongoDB Atlas Staging Setup

> [!WARNING]
> Never reuse the staging database cluster, credentials, or network rules for production.

## 1. Create Organization and Project
1. Log into MongoDB Atlas.
2. Create a Project named `Hyperlocal-Staging`.

## 2. Deploy Staging Cluster
1. Choose an M10 or equivalent dedicated cluster (required to test replica-set transaction limits accurately, though M0 sandbox is acceptable for initial integration).
2. Enable Backup (Continuous Cloud Backups).

## 3. Database Access (Least Privilege)
1. Create a user: `staging_api_user`.
2. Assign role: `readWriteAnyDatabase` (or restrict strictly to the `hyperlocal_staging` database).
3. Generate a secure, 32+ character password. Do not store this password anywhere except the hosting provider's Secret Manager.

## 4. Network Access
1. Retrieve the static outbound IPs of your staging backend host (e.g., Render static IPs, AWS NAT Gateway IP).
2. Add these IPs to the Atlas Network Access list.
3. Remove `0.0.0.0/0` (Allow Access from Anywhere) immediately.

## 5. Verification
1. Connect the backend and observe the logs.
2. Run `npm run test:query-plans` locally against a remote staging DB temporarily to ensure index definitions (`IXSCAN`) propagate correctly.
3. Verify transaction support by executing a mock booking creation flow.
4. Schedule and perform a backup restoration drill to a secondary temporary cluster to prove RTO/RPO SLA compliance.
