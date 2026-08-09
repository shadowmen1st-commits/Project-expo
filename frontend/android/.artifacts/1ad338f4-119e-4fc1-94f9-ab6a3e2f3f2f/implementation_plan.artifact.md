# Implementation Plan - Fix Registration Flow

Fix registration failure across all roles (CUSTOMER, WORKER, COMPANY) and ensure production Render backend connectivity.

## User Review Required

> [!IMPORTANT]
> The `Register.jsx` page currently has a 'Company' button that submits a basic form. However, a full Company registration requires more details (address, GST, etc.). I will modify `Register.jsx` to redirect to the dedicated `CompanyRegister.jsx` page when 'Company' is selected to ensure all required data is collected.

## Proposed Changes

### Frontend Component

#### [MODIFY] [api.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/frontend/src/config/api.js)
- Enhance error logging to include full response data and status code for easier debugging.

#### [MODIFY] [AuthContext.jsx](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/frontend/src/context/AuthContext.jsx)
- Add logging for registration requests and responses.

#### [MODIFY] [Register.jsx](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/frontend/src/pages/Register.jsx)
- Update role selector to navigate to `/register/company` when 'COMPANY' is clicked.
- This ensures users are directed to the correct form with all required fields for business registration.

#### [MODIFY] [CompanyRegister.jsx](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/frontend/src/pages/CompanyRegister.jsx)
- Replace direct `axios` usage with the configured `api` instance.
- Update endpoint from `/api/company/register` to `/company/register` (since `api` instance already includes `/api`).
- Ensure consistent error handling and logging.

---

### Backend Component

#### [MODIFY] [authController.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/backend/src/controllers/authController.js)
- Fix the profile creation logic in the `register` function.
- Ensure 'COMPANY' role is not incorrectly creating a `WorkerProfile`.
- Add explicit logging for registration hits.

#### [MODIFY] [companyController.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/backend/src/controllers/companyController.js)
- Ensure consistent return format for errors.
- Verify `CompanyWallet` creation upon successful registration.

---

### Verification Plan

#### Automated Tests
- Run existing tests in `backend/tests/` and `frontend/tests/` (if any).
- Build the project to ensure no syntax errors.

#### Manual Verification
- Test CUSTOMER registration: Verify user created in MongoDB `users` collection.
- Test WORKER registration: Verify user created in `users` and `workerprofiles` collection.
- Test COMPANY registration: Verify user created in `users` and `companyprofiles` collection, and a `companywallets` record exists.
- Verify that duplicate email/phone correctly returns a conflict error.
- Verify that selected role is sent as enum (CUSTOMER/WORKER/COMPANY).
- Verify logs show the HTTP status and backend response.
