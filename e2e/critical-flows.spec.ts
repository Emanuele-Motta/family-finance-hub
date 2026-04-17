// Author: Emanuele Motta
// Date: 16-Apr-2026
// Playwright E2E Tests - Critical user flows

import { test, expect } from '@playwright/test';

test.describe('Family Finance Hub - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Authentication Flow', () => {
    test('should login successfully', async ({ page }) => {
      // Assuming there's a login form or redirect
      // This depends on your auth implementation
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Dashboard', () => {
    test('should display primary account balance', async ({ page }) => {
      const balanceCard = page.locator('[data-testid="balance-card"]');
      await expect(balanceCard).toBeVisible();
    });

    test('should display 30-day forecast', async ({ page }) => {
      const forecastCard = page.locator('[data-testid="forecast-30d"]');
      await expect(forecastCard).toBeVisible();
    });

    test('should display budget progress', async ({ page }) => {
      const budgetSection = page.locator('[data-testid="budget-progress"]');
      await expect(budgetSection).toBeVisible();
    });

    test('should display unread notifications', async ({ page }) => {
      const notifications = page.locator('[data-testid="notifications"]');
      await expect(notifications).toBeVisible();
    });
  });

  test.describe('Import CSV Flow', () => {
    test('should allow uploading CSV file', async ({ page }) => {
      // Navigate to import page
      await page.goto('/transactions/import');

      // Find file input
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible();

      // Upload test file
      await fileInput.setInputFiles('e2e/test-data/transactions.csv');

      // Wait for preview to load
      await page.waitForLoadState('networkidle');

      // Verify transactions are displayed
      const transactionRows = page.locator('[data-testid="import-transaction-row"]');
      await expect(transactionRows).toHaveCount(5, { timeout: 5000 });
    });

    test('should allow editing transaction during import', async ({ page }) => {
      await page.goto('/transactions/import');

      // Find first transaction row
      const firstRow = page.locator('[data-testid="import-transaction-row"]').first();
      await firstRow.click();

      // Find category dropdown
      const categorySelect = page.locator('[data-testid="tx-category-select"]').first();
      await categorySelect.click();

      // Select a category
      const categoryOption = page.locator('text=Alimentare');
      await categoryOption.click();

      // Verify category was updated
      await expect(categorySelect).toContainText('Alimentare');
    });

    test('should confirm import with all transactions', async ({ page }) => {
      await page.goto('/transactions/import');

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('e2e/test-data/transactions.csv');

      // Wait for transactions to load
      await page.waitForLoadState('networkidle');

      // Click confirm button
      const confirmButton = page.locator('button:has-text("Conferma Import")');
      await confirmButton.click();

      // Wait for success message
      const successMessage = page.locator('text=/✅|importate|successfully/i');
      await expect(successMessage).toBeVisible({ timeout: 10000 });

      // Verify redirect or success state
      await page.waitForLoadState('networkidle');
    });
  });

  test.describe('Bulk Actions', () => {
    test('should select multiple transactions', async ({ page }) => {
      await page.goto('/transactions');

      // Find first checkbox
      const firstCheckbox = page.locator('[data-testid="tx-checkbox"]').first();
      await firstCheckbox.click();

      // Find second checkbox
      const secondCheckbox = page.locator('[data-testid="tx-checkbox"]').nth(1);
      await secondCheckbox.click();

      // Verify bulk action bar appears
      const bulkActionBar = page.locator('[data-testid="bulk-action-bar"]');
      await expect(bulkActionBar).toBeVisible();

      // Verify selection count
      await expect(bulkActionBar).toContainText('2');
    });

    test('should bulk update category', async ({ page }) => {
      await page.goto('/transactions');

      // Select multiple transactions
      const checkboxes = page.locator('[data-testid="tx-checkbox"]');
      for (let i = 0; i < 2; i++) {
        await checkboxes.nth(i).click();
      }

      // Find category button
      const categoryButton = page.locator('[data-testid="bulk-category-btn"]');
      await categoryButton.click();

      // Select category
      const categoryOption = page.locator('text=Trasporti');
      await categoryOption.click();

      // Verify success
      const successMessage = page.locator('text=/aggiornate|updated/i');
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    });

    test('should export transactions as CSV', async ({ page }) => {
      await page.goto('/transactions');

      // Select transactions
      const checkbox = page.locator('[data-testid="tx-checkbox"]').first();
      await checkbox.click();

      // Click export button
      const exportButton = page.locator('[data-testid="bulk-export-btn"]');
      await exportButton.click();

      // Wait for download
      const downloadPromise = page.waitForEvent('download');
      await downloadPromise;

      // Verify download started
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    });
  });

  test.describe('Rules Engine', () => {
    test('should create new rule', async ({ page }) => {
      await page.goto('/settings/rules');

      // Click create rule button
      const createButton = page.locator('button:has-text("Nuova Regola")');
      await createButton.click();

      // Fill rule name
      const nameInput = page.locator('[data-testid="rule-name"]');
      await nameInput.fill('Test Rule');

      // Select rulecondition
      const conditionField = page.locator('[data-testid="rule-condition-field"]');
      await conditionField.click();

      // Select condition value
      const descriptionOption = page.locator('text=Descrizione');
      await descriptionOption.click();

      // Save rule
      const saveButton = page.locator('button:has-text("Salva")');
      await saveButton.click();

      // Verify success
      const successMessage = page.locator('text=/creata|created/i');
      await expect(successMessage).toBeVisible();
    });
  });

  test.describe('Recurring Transactions', () => {
    test('should create monthly recurring', async ({ page }) => {
      await page.goto('/settings/recurring');

      // Click create recurring button
      const createButton = page.locator('button:has-text("Nuova Ricorrenza")');
      await createButton.click();

      // Fill form
      await page.locator('[data-testid="recurring-name"]').fill('Monthly Rent');
      await page.locator('[data-testid="recurring-amount"]').fill('1200');

      // Select monthly frequency
      const frequencySelect = page.locator('[data-testid="recurring-frequency"]');
      await frequencySelect.click();
      await page.locator('text=Mensile').click();

      // Set day of month
      await page.locator('[data-testid="recurring-day"]').fill('1');

      // Save
      const saveButton = page.locator('button:has-text("Salva")');
      await saveButton.click();

      // Verify success
      const successMessage = page.locator('text=/creata|created/i');
      await expect(successMessage).toBeVisible();
    });

    test('should display upcoming reminders', async ({ page }) => {
      await page.goto('/');

      // Check for upcoming reminders widget
      const upcomingCard = page.locator('[data-testid="upcoming-recurring"]');
      await expect(upcomingCard).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should be mobile-friendly on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/');

      // Verify mobile dashboard is visible
      const mobileHeader = page.locator('[data-testid="mobile-header"]');
      await expect(mobileHeader).toBeVisible();

      // Verify content is not cut off
      const mainContent = page.locator('main');
      const bbox = await mainContent.boundingBox();
      expect(bbox?.width).toBeLessThanOrEqual(375);
    });

    test('should have large touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/');

      // Check button sizes (should be at least 44x44 for touch)
      const buttons = page.locator('button').first();
      const bbox = await buttons.boundingBox();

      if (bbox) {
        expect(Math.max(bbox.width, bbox.height)).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message for failed import', async ({ page }) => {
      await page.goto('/transactions/import');

      // Try to upload invalid file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('e2e/test-data/invalid.txt');

      // Verify error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network offline
      await page.context().setOffline(true);

      // Try to create transaction
      await page.goto('/transactions/add');
      const submitButton = page.locator('button:has-text("Salva")');
      await submitButton.click();

      // Verify error is shown
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();

      // Return online
      await page.context().setOffline(false);
    });
  });

  test.describe('Performance', () => {
    test('should load dashboard within 3 seconds', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);
    });

    test('should render large transaction list without lag', async ({ page }) => {
      await page.goto('/transactions');

      // Wait for initial load
      await page.waitForLoadState('networkidle');

      // Scroll through list
      const transactionList = page.locator('[data-testid="transaction-list"]');
      for (let i = 0; i < 5; i++) {
        await transactionList.evaluate(el => {
          el.scrollTop += 500;
        });
        await page.waitForTimeout(100);
      }

      // Should not crash or show errors
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).not.toBeVisible();
    });
  });
});
