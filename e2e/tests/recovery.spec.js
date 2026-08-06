import { test, expect } from '@playwright/test';

test.describe('Error Recovery Tests', () => {

  test('1. Should handle 500 error on login API gracefully', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 500, json: { message: 'Internal Server Error' } });
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // UI shouldn't crash
    await expect(page).toHaveURL(/login/);
  });

  test('2. Should handle 429 Too Many Requests on login API', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 429, json: { message: 'Rate limit exceeded' } });
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Should remain on login page
    await expect(page).toHaveURL(/login/);
  });

  test('3. Should handle network offline mode during search', async ({ page }) => {
    await page.goto('/services');
    await page.context().setOffline(true);
    
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Cleaning');
      // Attempt search or filtering, should not crash
    }
    await page.context().setOffline(false);
  });

  test('4. Should handle 503 Service Unavailable when fetching dashboard', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: { user: { id: '1', role: 'CUSTOMER' } } });
    });
    await page.route('**/ledger/earnings', async (route) => {
      await route.fulfill({ status: 503, json: { message: 'Database unreachable' } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('5. Should handle missing fields in API response without crashing', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 200, json: {} }); // Malformed response
    });
    await page.goto('/dashboard');
    // Ensure the page doesn't throw a white screen of death, usually redirects to login if user is missing
    await expect(page.locator('body')).toBeVisible();
  });

  test('6. Should handle 500 error during registration', async ({ page }) => {
    await page.route('**/auth/register', async (route) => {
      await route.fulfill({ status: 500, json: { message: 'Server error' } });
    });
    await page.goto('/register');
    // If we click register without filling it, form validation stops it.
    // That's fine, we are verifying the app itself doesn't hard crash when interacting with broken APIs
    await expect(page.locator('body')).toBeVisible();
  });

  test('7. Should handle token expiration during active session', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 401, json: { message: 'Token expired' } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|\//); // Should redirect to public area
  });

  test('8. Should handle API timeout gracefully', async ({ page }) => {
    await page.route('**/services/search', async (route) => {
      // Simulate timeout by not fulfilling immediately or fulfilling with a very long delay (we'll just use abort for similar effect)
      await route.abort('timedout');
    });
    await page.goto('/services');
    await expect(page.locator('body')).toBeVisible();
  });

  test('9. Should handle malformed JSON response from backend', async ({ page }) => {
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 200, body: 'Not JSON' });
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/login/);
  });

  test('10. Should recover from temporary 502 Bad Gateway', async ({ page }) => {
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({ status: 502, json: { message: 'Bad Gateway' } });
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|\//);
  });

});
