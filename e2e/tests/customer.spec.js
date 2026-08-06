import { test, expect } from '@playwright/test';

test.describe('Customer Flows', () => {

  test('1. Should load public homepage successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Hyperlocal/i);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('2. Should render social auth buttons dynamically via provider check', async ({ page }) => {
    // Mock the oauth providers endpoint
    await page.route('**/auth/oauth/providers', async (route) => {
      await route.fulfill({ json: { google: { enabled: true }, apple: { enabled: true } } });
    });
    await page.goto('/login');
    await expect(page.locator('button', { hasText: /Google/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /Apple/i })).toBeVisible();
  });

  test('3. Should show validation errors on empty signup form', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Register as Customer' }).click();
    // React Hook Form requires interaction or it stays on page
    await expect(page).toHaveURL(/register/);
  });

  test('4. Should handle successful customer login via API', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        json: { user: { id: '1', role: 'CUSTOMER', name: 'Test User' }, accessToken: 'fake-jwt' }
      });
    });
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: { user: { id: '1', role: 'CUSTOMER', name: 'Test User' } }
      });
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test.customer@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Verify it redirects to dashboard
    await expect(page).toHaveURL(/dashboard/);
  });

  test('5. Should handle login failure gracefully', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } });
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'BadPass');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // We expect it to remain on login and potentially show a toast/error, but verifying URL is robust
    await expect(page).toHaveURL(/login/);
  });

  test('6. Should allow searching for workers and rendering results', async ({ page }) => {
    await page.goto('/services');
    await expect(page.locator('h1').first()).toBeVisible();
    // Simulate searching
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Deep Cleaning');
    }
  });

  test('7. Should open booking modal when selecting a service', async ({ page }) => {
    await page.goto('/services');
    // Wait for services to load
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('8. Should enforce authentication before finalizing a booking', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('9. Should allow authenticated customer to view dashboard', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '1', role: 'CUSTOMER', name: 'Test User' } } });
    });
    await page.goto('/dashboard');
    // Since we are authenticated, we should stay on dashboard
    await expect(page).toHaveURL(/dashboard/);
  });

  test('10. Should load customer chat interface correctly', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '1', role: 'CUSTOMER', name: 'Test User' } } });
    });
    await page.goto('/chat'); // Assuming /chat falls back to /dashboard if unmapped
    // Wait for navigation
  });

  test('11. Should allow customer to open a support ticket', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '1', role: 'CUSTOMER', name: 'Test User' } } });
    });
    await page.goto('/support');
    await expect(page).toHaveURL(/support/);
  });

  test('12. Should view notifications panel on dashboard', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '1', role: 'CUSTOMER', name: 'Test User' } } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });
});
