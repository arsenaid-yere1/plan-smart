import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard', () => {
  // Onboarding requires authenticated user
  // These tests verify the UI works correctly
  test.describe('Unauthenticated user', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto('/onboarding');
      // Middleware should redirect to login
      await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 });
    });
  });

  // These tests require a fully configured Supabase with working auth
  // They're skipped by default and should be run manually when testing
  // the complete auth flow with a real test environment
  test.describe('Authenticated user @manual', () => {
    // Skip this entire describe block - authenticated tests need manual setup
    test.skip();

    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/auth/login');
      await page.fill('[id="email"]', 'test@example.com');
      await page.fill('[id="password"]', 'SecurePassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Navigate to onboarding
      await page.goto('/onboarding');
    });

    test('should show step 1 of 4', async ({ page }) => {
      await expect(page.locator('text=Step 1 of 4')).toBeVisible();
    });

    test('should complete all onboarding steps', async ({ page }) => {
      // Step 1: Birth year
      await expect(page.locator('text=Step 1 of 4')).toBeVisible();
      await page.fill('[id="birthYear"]', '1985');
      await page.click('button:has-text("Continue")');

      // Step 2: Retirement info
      await expect(page.locator('text=Step 2 of 4')).toBeVisible();
      await page.fill('[id="targetRetirementAge"]', '65');
      await page.check('[value="single"]');
      await page.click('button:has-text("Continue")');

      // Step 3: Financial info
      await expect(page.locator('text=Step 3 of 4')).toBeVisible();
      await page.fill('[id="annualIncome"]', '75000');
      await page.fill('[id="savingsRate"]', '15');
      await page.click('button:has-text("Continue")');

      // Step 4: Risk tolerance
      await expect(page.locator('text=Step 4 of 4')).toBeVisible();
      await page.check('[value="moderate"]');
      await page.click('button:has-text("Complete Setup")');

      // Should redirect to plans page
      await expect(page).toHaveURL(/plans/, { timeout: 10000 });
    });

    test('should allow going back and preserve data', async ({ page }) => {
      // Step 1
      await page.fill('[id="birthYear"]', '1985');
      await page.click('button:has-text("Continue")');

      // Step 2
      await page.fill('[id="targetRetirementAge"]', '65');
      await page.click('button:has-text("Continue")');

      // Go back to step 2
      await page.click('button:has-text("Back")');

      // Verify data is preserved
      await expect(page.locator('[id="targetRetirementAge"]')).toHaveValue(
        '65'
      );

      // Go back to step 1
      await page.click('button:has-text("Back")');

      // Verify data is preserved
      await expect(page.locator('[id="birthYear"]')).toHaveValue('1985');
    });
  });
});
