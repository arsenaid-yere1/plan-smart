import { test, expect } from '@playwright/test';

test.describe('User Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and wait for form to load
    await page.goto('/auth/login');
    await page.waitForSelector('form');
  });

  test('should display login form with all elements', async ({ page }) => {
    // Verify form elements are present
    await expect(page.locator('[id="email"]')).toBeVisible();
    await expect(page.locator('[id="password"]')).toBeVisible();
    await expect(page.locator('[id="rememberMe"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('text=Forgot password?')).toBeVisible();
    await expect(page.locator('text=Sign up')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('[id="email"]', 'nonexistent@example.com');
    await page.fill('[id="password"]', 'SomePassword123!');
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(
      page.locator('text=Invalid email or password')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.click('text=Forgot password?');
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.click('text=Sign up');
    await expect(page).toHaveURL(/signup/);
  });

  // Tests requiring valid Supabase auth - skipped by default
  test.describe('With authenticated user @manual', () => {
    test.skip();

    test('should login successfully with valid credentials', async ({
      page,
    }) => {
      await page.fill('[id="email"]', 'test@example.com');
      await page.fill('[id="password"]', 'SecurePassword123!');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    });

    test('should set 7-day cookie with remember me', async ({
      page,
      context,
    }) => {
      await page.fill('[id="email"]', 'test@example.com');
      await page.fill('[id="password"]', 'SecurePassword123!');
      await page.check('[id="rememberMe"]');
      await page.click('button[type="submit"]');

      // Check cookie expiration
      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find((c) => c.name === 'access_token');

      expect(accessTokenCookie).toBeDefined();
      // 7 days = 604800 seconds
      expect(accessTokenCookie!.expires).toBeGreaterThan(
        Date.now() / 1000 + 604000
      );
    });
  });
});
