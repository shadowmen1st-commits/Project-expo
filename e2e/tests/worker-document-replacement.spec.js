import { test, expect } from '@playwright/test';

const profile = { verificationStatus: 'DRAFT', onboardingProgressPercent: 40 };
const setupWorker = async (page, documents = [], duplicateOnPost = false) => {
  let postAttempted = false;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ status: 200, json: { user: { id: 'worker-1', role: 'WORKER', name: 'Test Worker' } } });
    if (url.pathname.endsWith('/admin/categories/all')) return route.fulfill({ status: 200, json: { success: true, categories: [] } });
    if (url.pathname.endsWith('/v1/worker/verification') && route.request().method() === 'GET') {
      const current = postAttempted ? [{ id: 'existing-license', documentType: 'DRIVING_LICENSE', documentNumberLast4: '1234', verificationStatus: 'UPLOADED', version: 1, historicalVersionCount: 0 }] : documents;
      return route.fulfill({ status: 200, json: { success: true, data: { profile, requiredDocumentTypes: ['DRIVING_LICENSE'], uploadedDocuments: current, submissionHistory: [] } } });
    }
    if (url.pathname.endsWith('/v1/worker/verification/documents') && route.request().method() === 'POST' && duplicateOnPost) {
      postAttempted = true;
      return route.fulfill({ status: 409, json: { errorCode: 'DOCUMENT_ALREADY_EXISTS', existingDocumentId: 'existing-license', allowedAction: 'REPLACE', message: 'A current document exists.' } });
    }
    return route.fulfill({ status: 200, json: { success: true, data: {} } });
  });
};

const openDocumentsStep = async page => {
  await page.goto('/worker/verification');
  await expect(page.getByRole('heading', { name: 'Personal Identification' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
};

test('new document type shows Upload Document', async ({ page }) => {
  await setupWorker(page);
  await openDocumentsStep(page);
  await expect(page.getByRole('button', { name: /Upload Document/i })).toBeVisible();
});

test('current document is displayed and switches action to Replace Document', async ({ page }) => {
  await setupWorker(page, [{ id: 'license-1', documentType: 'DRIVING_LICENSE', documentNumberLast4: '4321', verificationStatus: 'CHANGES_REQUIRED', version: 2, historicalVersionCount: 1 }]);
  await openDocumentsStep(page);
  await expect(page.getByText('Active Uploaded Documents')).toBeVisible();
  await expect(page.getByText(/4321/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Replace Document/i })).toBeVisible();
});

test('duplicate POST refreshes state and never exposes raw DUPLICATE_RECORD', async ({ page }) => {
  await setupWorker(page, [], true);
  await openDocumentsStep(page);
  await page.getByPlaceholder('Enter DRIVING_LICENSE Identifier').fill('DL-1234');
  await page.locator('input[type=file]').setInputFiles({ name: 'license.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
  await page.getByRole('button', { name: /Upload Document/i }).click();
  await expect(page.getByRole('button', { name: /Replace Document/i })).toBeVisible();
  await expect(page.getByText(/Use Replace Document/i)).toBeVisible();
  await expect(page.getByText('DUPLICATE_RECORD')).toHaveCount(0);
});
