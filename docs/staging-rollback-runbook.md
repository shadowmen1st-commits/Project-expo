# Staging Rollback Runbook

> [!WARNING]
> Do not delete the staging database automatically upon rollback. Data loss prevents forensic investigation.

## Frontend Rollback
1. Access the hosting provider (e.g., Vercel / Netlify / AWS Amplify).
2. Locate the list of recent deployments.
3. Identify the last known healthy deployment hash/ID.
4. Select "Promote to Production" or "Rollback to this deployment".
5. Wait for the CDN cache invalidation (usually < 1 minute).
6. Verify rollback by checking the version badge/footer.

## Backend Rollback
1. Access the backend host (e.g., Render, Railway, AWS ECS).
2. Identify the last stable Docker Image Tag or commit hash.
3. Redeploy the previous version.
4. Verify `/health` and `/ready` return 200.

## Database Schema/Index Rollback
1. If the failed deployment included a backward-incompatible schema migration (e.g., dropping a column, renaming a field):
   - You MUST run the corresponding `down` migration script before rolling back the backend code.
   - If a rollback script is unavailable, refer to the Database Backup snapshot taken immediately prior to deployment.
2. If restoring a snapshot, alert the team that data written during the broken window will be lost.

## Incident Communication
1. Notify `#devops-alerts` in Slack/Teams.
2. Document the rollback timeline.
3. Mark the failing commit as `DONOTDEPLOY`.
