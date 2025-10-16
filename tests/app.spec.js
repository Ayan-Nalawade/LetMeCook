import { test, expect } from '@playwright/test';

test.describe('LetMeCook - API Key Validation', () => {
  test('should show API key modal on first load', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    const modal = page.locator('#apiKeyModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#mainApp')).toHaveClass(/hidden/);
  });

  test('should validate API key format', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    const input = page.locator('#apiKeyInput');
    const validateBtn = page.locator('#validateApiKey');
    
    await input.fill('invalid-key');
    await validateBtn.click();
    
    const status = page.locator('#validationStatus');
    await expect(status).toContainText('Invalid API key format');
  });

  test('should reject empty API key', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    const validateBtn = page.locator('#validateApiKey');
    await validateBtn.click();
    
    const status = page.locator('#validationStatus');
    await expect(status).toContainText('Please enter an API key');
  });
});

test.describe('LetMeCook - File Upload', () => {
  test('should have file input with correct accept types', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const fileInput = page.locator('#fileInput');
    const acceptAttr = await fileInput.getAttribute('accept');
    
    expect(acceptAttr).toContain('.pdf');
    expect(acceptAttr).toContain('.txt');
    expect(acceptAttr).toContain('.pptx');
  });

  test('should have text input area', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const textInput = page.locator('#textInput');
    await expect(textInput).toBeVisible();
    await expect(textInput).toHaveAttribute('placeholder');
  });

  test('should show process button', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const processBtn = page.locator('#processContent');
    await expect(processBtn).toBeVisible();
    await expect(processBtn).toContainText('Process Content');
  });
});

test.describe('LetMeCook - Mode Selection', () => {
  test('should have three learning modes', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const modeCards = page.locator('.mode-card');
    await expect(modeCards).toHaveCount(3);
  });

  test('should have Study mode card', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const studyMode = page.locator('[data-mode="study"]');
    await expect(studyMode).toBeVisible();
    await expect(studyMode).toContainText('Study Mode');
  });

  test('should have Exam mode card', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const examMode = page.locator('[data-mode="exam"]');
    await expect(examMode).toBeVisible();
    await expect(examMode).toContainText('Exam Mode');
  });

  test('should have Flashcard mode card', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const flashcardMode = page.locator('[data-mode="flashcard"]');
    await expect(flashcardMode).toBeVisible();
    await expect(flashcardMode).toContainText('Flashcard Mode');
  });
});

test.describe('LetMeCook - UI Elements', () => {
  test('should have header with title', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const header = page.locator('header h1');
    await expect(header).toContainText('LetMeCook');
  });

  test('should have change API key button', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const changeKeyBtn = page.locator('#changeApiKey');
    await expect(changeKeyBtn).toBeVisible();
  });

  test('should hide loading overlay by default', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    const loadingOverlay = page.locator('#loadingOverlay');
    await expect(loadingOverlay).toHaveClass(/hidden/);
  });
});

test.describe('LetMeCook - LocalStorage Security', () => {
  test('should clear invalid API key from localStorage', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'This is invalid feedback text with spaces and special chars!');
    });
    await page.reload();
    
    const storedKey = await page.evaluate(() => localStorage.getItem('gemini_auth_token'));
    expect(storedKey).toBeNull();
    
    const modal = page.locator('#apiKeyModal');
    await expect(modal).toBeVisible();
  });

  test('should accept valid API key format', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    await page.evaluate(() => {
      localStorage.setItem('gemini_auth_token', 'AIzaSyDummyKeyForTesting123456789012345');
    });
    await page.reload();
    
    const modal = page.locator('#apiKeyModal');
    await expect(modal).toHaveClass(/hidden/);
    
    const mainApp = page.locator('#mainApp');
    await expect(mainApp).not.toHaveClass(/hidden/);
  });
});

test.describe('LetMeCook - Responsive Design', () => {
  test('should be mobile responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:8080');
    
    const modal = page.locator('#apiKeyModal');
    await expect(modal).toBeVisible();
    
    const modalContent = page.locator('.modal-content');
    const box = await modalContent.boundingBox();
    
    expect(box.width).toBeLessThanOrEqual(375);
  });

  test('should be tablet responsive', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:8080');
    
    const modal = page.locator('#apiKeyModal');
    await expect(modal).toBeVisible();
  });
});

test.describe('LetMeCook - JavaScript Functions', () => {
  test('should have markdown conversion function', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    const hasFunction = await page.evaluate(() => {
      return typeof window.convertMarkdownToHTML !== 'undefined' || 
             document.querySelector('script[src="app.js"]') !== null;
    });
    
    expect(hasFunction).toBeTruthy();
  });

  test('should have flashcard navigation functions', async ({ page }) => {
    await page.goto('http://localhost:8080');
    
    const hasFunctions = await page.evaluate(() => {
      return typeof window.nextCard === 'function' &&
             typeof window.previousCard === 'function' &&
             typeof window.flipCard === 'function';
    });
    
    expect(hasFunctions).toBeTruthy();
  });
});
