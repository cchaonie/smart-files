import { test, expect } from '../support/fixtures';
import { createFolder, createFile } from '../support/factories/file-factory';

test.describe('File Management', () => {
  test.beforeEach(async ({ page, auth }) => {
    // Login before each test
    const user = await auth.registerUser();
    await auth.loginAs(user.email, user.password);
    await page.goto('/files');
  });

  test('user can create a new folder', async ({ page }) => {
    // Arrange
    const folderName = 'Test Folder';

    // Act
    await page.fill('[data-testid="new-folder-input"]', folderName);
    await page.click('[data-testid="create-folder-button"]');

    // Assert
    await expect(page.getByText(folderName)).toBeVisible();
  });

  test('user can navigate into a folder', async ({ page }) => {
    // Arrange - Create a folder
    const folderName = 'Documents';
    await page.fill('[data-testid="new-folder-input"]', folderName);
    await page.click('[data-testid="create-folder-button"]');

    // Act
    await page.click(`[data-testid="folder-${folderName}"]`);

    // Assert
    await expect(page.getByText(`/${folderName}`)).toBeVisible();
    await expect(page.getByText('This folder is empty.')).toBeVisible();
  });

  test('user can navigate back from a folder', async ({ page }) => {
    // Arrange - Create and enter a folder
    const folderName = 'Projects';
    await page.fill('[data-testid="new-folder-input"]', folderName);
    await page.click('[data-testid="create-folder-button"]');
    await page.click(`[data-testid="folder-${folderName}"]`);

    // Act
    await page.click('[data-testid="back-button"]');

    // Assert
    await expect(page.getByText('Root')).toBeVisible();
    await expect(page.getByText(folderName)).toBeVisible();
  });

  test('user can rename a folder', async ({ page }) => {
    // Arrange - Create a folder
    const oldName = 'Old Name';
    const newName = 'New Name';
    await page.fill('[data-testid="new-folder-input"]', oldName);
    await page.click('[data-testid="create-folder-button"]');

    // Act
    await page.click(`[data-testid="rename-folder-${oldName}"]`);
    await page.fill('[data-testid="rename-input"]', newName);
    await page.click('[data-testid="confirm-rename"]');

    // Assert
    await expect(page.getByText(newName)).toBeVisible();
    await expect(page.getByText(oldName)).not.toBeVisible();
  });

  test('user can delete a folder', async ({ page }) => {
    // Arrange - Create a folder
    const folderName = 'To Delete';
    await page.fill('[data-testid="new-folder-input"]', folderName);
    await page.click('[data-testid="create-folder-button"]');

    // Act
    page.on('dialog', dialog => dialog.accept());
    await page.click(`[data-testid="delete-folder-${folderName}"]`);

    // Assert
    await expect(page.getByText(folderName)).not.toBeVisible();
  });

  test('empty folder shows empty state', async ({ page }) => {
    // Arrange - Create and enter a folder
    const folderName = 'Empty Folder';
    await page.fill('[data-testid="new-folder-input"]', folderName);
    await page.click('[data-testid="create-folder-button"]');
    await page.click(`[data-testid="folder-${folderName}"]`);

    // Assert
    await expect(page.getByText('This folder is empty.')).toBeVisible();
  });
});

test.describe('File Upload', () => {
  test.beforeEach(async ({ page, auth }) => {
    const user = await auth.registerUser();
    await auth.loginAs(user.email, user.password);
    await page.goto('/files');
  });

  test('user can upload a file', async ({ page }) => {
    // Arrange
    const fileName = 'test-document.pdf';

    // Act - Upload file using file chooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-button"]'),
    ]);

    await fileChooser.setFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from('test file content'),
    });

    // Assert
    await expect(page.getByText(fileName)).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
  });

  test('user can delete a file', async ({ page }) => {
    // Arrange - Upload a file first
    const fileName = 'to-delete.txt';
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-button"]'),
    ]);

    await fileChooser.setFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('delete me'),
    });

    await expect(page.getByText(fileName)).toBeVisible();

    // Act
    page.on('dialog', dialog => dialog.accept());
    await page.click(`[data-testid="delete-file-${fileName}"]`);

    // Assert
    await expect(page.getByText(fileName)).not.toBeVisible();
  });

  test('user can download a file', async ({ page }) => {
    // Arrange - Upload a file
    const fileName = 'download-test.txt';
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-button"]'),
    ]);

    await fileChooser.setFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('download content'),
    });

    // Act & Assert - Check download link exists
    const downloadLink = page.locator(`[data-testid="download-${fileName}"]`);
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute('href', /\/api\/files\/.*\/download/);
  });
});
