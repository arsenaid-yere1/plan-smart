import { test, expect } from '@playwright/test';

test.describe('User Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForSelector('form');
  });

  test('should display signup form with all elements', async ({ page }) => {
    await expect(page.locator('[id="email"]')).toBeVisible();
    await expect(page.locator('[id="password"]')).toBeVisible();
    await expect(page.locator('[id="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show password strength indicator', async ({ page }) => {
    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'weak');

    // Password strength should show something (Weak indicator)
    await expect(page.locator('text=Weak')).toBeVisible({ timeout: 5000 });
  });

  test('should show Strong for good password', async ({ page }) => {
    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'SecurePassword123!');

    await expect(page.locator('text=Strong')).toBeVisible({ timeout: 5000 });
  });

  test('should reject mismatched passwords', async ({ page }) => {
    await page.fill('[id="email"]', 'test@example.com');
    await page.fill('[id="password"]', 'SecurePassword123!');
    await page.fill('[id="confirmPassword"]', 'DifferentPassword123!');

    await page.click('button[type="submit"]');

    await expect(page.locator("text=Passwords don't match")).toBeVisible({
      timeout: 5000,
    });
  });

  test('should navigate to login page', async ({ page }) => {
    const loginLink = page.locator('a:has-text("Log in")');
    await loginLink.click();
    await expect(page).toHaveURL(/login/);
  });

  // Full signup flow requires real Supabase - skipped by default
  test.describe('Full signup flow @manual', () => {
    test.skip();

    test('should complete signup and show verification page', async ({
      page,
    }) => {
      const testEmail = `test+${Date.now()}@example.com`;
      await page.fill('[id="email"]', testEmail);
      await page.fill('[id="password"]', 'SecurePassword123!');
      await page.fill('[id="confirmPassword"]', 'SecurePassword123!');

      // Verify password strength meter shows "Strong"
      await expect(page.locator('text=Strong')).toBeVisible();

      await page.click('button[type="submit"]');

      // Should redirect to verification page
      await expect(page).toHaveURL(/verify-email/, { timeout: 10000 });
      await expect(page.locator('text=Check your email')).toBeVisible();
    });
  });
});
