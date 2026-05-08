import { test, expect } from '../support/fixtures';

test.describe('Authentication Flow', () => {
  test('user can register a new account', async ({ page, auth }) => {
    // Arrange
    const user = await auth.registerUser();

    // Act - Navigate to files page (should be accessible after auth)
    await page.goto('/files');

    // Assert
    await expect(page.getByText('Your files')).toBeVisible();
    await expect(page.getByText(user.name)).toBeVisible();
  });

  test('user can login with existing account', async ({ page, auth }) => {
    // Arrange - Register first
    const user = await auth.registerUser();

    // Act - Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', user.email);
    await page.fill('[data-testid="password"]', user.password);
    await page.click('[data-testid="submit"]');

    // Assert - Redirected to files
    await expect(page).toHaveURL('/files');
    await expect(page.getByText('Your files')).toBeVisible();
  });

  test('user sees error with invalid credentials', async ({ page }) => {
    // Act
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'invalid@example.com');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="submit"]');

    // Assert
    await expect(page.getByText(/invalid/i)).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Act - Try to access protected route
    await page.goto('/files');

    // Assert - Redirected to login
    await expect(page).toHaveURL('/login');
  });

  test('user can logout', async ({ page, auth }) => {
    // Arrange - Login first
    const user = await auth.registerUser();
    await auth.loginAs(user.email, user.password);

    // Act
    await page.goto('/files');
    await page.click('[data-testid="logout-button"]');

    // Assert
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Sign in')).toBeVisible();
  });
});
