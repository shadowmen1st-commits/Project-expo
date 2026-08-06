import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Mobile Small (iPhone SE)', width: 320, height: 568 },
  { name: 'Mobile Medium (iPhone 12 Pro)', width: 390, height: 844 },
  { name: 'Mobile Large (Google Pixel 5)', width: 393, height: 851 },
  { name: 'Tablet Portrait (iPad Mini)', width: 768, height: 1024 },
  { name: 'Tablet Landscape (iPad Air)', width: 1180, height: 820 },
  { name: 'Desktop Small (Laptop)', width: 1280, height: 800 },
  { name: 'Desktop Large (HD Monitor)', width: 1920, height: 1080 }
];

const pages = [
  { name: 'Homepage', path: '/' },
  { name: 'Services', path: '/services' },
  { name: 'Login', path: '/login' },
  { name: 'Register', path: '/register' },
  { name: 'Worker Landing', path: '/for-workers' },
  { name: 'Support', path: '/support' }
];

test.describe('Responsive Layout Tests', () => {
  for (const pageConfig of pages) {
    for (const vp of viewports) {
      test(`Should render ${pageConfig.name} correctly on ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(pageConfig.path);
        
        // Wait for network idle to ensure rendering
        await page.waitForLoadState('domcontentloaded');
        
        // Verify that there is no horizontal scroll causing overflow on mobile
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        
        // Minor tolerance for scrollbars
        expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 20);
        
        // Verify the app doesn't crash and body is visible
        await expect(page.locator('body')).toBeVisible();
      });
    }
  }
});
