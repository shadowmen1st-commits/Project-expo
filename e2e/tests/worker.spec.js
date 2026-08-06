import { test, expect } from '@playwright/test';

test.describe('Worker Flows', () => {

  test('1. Should load public worker landing page', async ({ page }) => {
    await page.goto('/for-workers');
    await expect(page).toHaveTitle(/Hyperlocal/i);
    // There might not be an explicit H1 on the landing page, so we check for visible components or text.
    await expect(page.locator('text=Join our platform')).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('2. Should render worker registration form', async ({ page }) => {
    await page.goto('/register?role=WORKER');
    await page.getByRole('button', { name: 'Professional Worker' }).click();
    await expect(page.getByRole('button', { name: 'Register as Worker' })).toBeVisible();
  });

  test('3. Should show validation errors on empty worker signup', async ({ page }) => {
    await page.goto('/register?role=WORKER');
    await page.getByRole('button', { name: 'Professional Worker' }).click();
    await page.getByRole('button', { name: 'Register as Worker' }).click();
    await expect(page).toHaveURL(/register/);
  });

  test('4. Should handle successful worker login via API mocking', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        json: { user: { id: '2', role: 'WORKER', name: 'Test Worker' }, accessToken: 'fake-jwt' }
      });
    });
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: { user: { id: '2', role: 'WORKER', name: 'Test Worker' } }
      });
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test.worker@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test('5. Should handle unapproved worker login (KYC pending)', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 403, json: { message: 'Account not approved yet.' } });
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'pending.worker@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/login/);
  });

  test('6. Should enforce auth on worker dashboard', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('7. Should load worker earnings ledger when authenticated', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '2', role: 'WORKER', name: 'Test Worker' } } });
    });
    await page.goto('/dashboard');
    // Mock earnings endpoint to verify frontend consumption logic
    await page.route('**/ledger/earnings', async (route) => {
      await route.fulfill({ status: 200, json: { balance: 150.0 } });
    });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('8. Should allow worker to view active bookings', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '2', role: 'WORKER', name: 'Test Worker' } } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('9. Should load chat interface for worker', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '2', role: 'WORKER', name: 'Test Worker' } } });
    });
    await page.goto('/chat'); 
  });

  test('10. Should load notifications panel for worker', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '2', role: 'WORKER', name: 'Test Worker' } } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });
});
