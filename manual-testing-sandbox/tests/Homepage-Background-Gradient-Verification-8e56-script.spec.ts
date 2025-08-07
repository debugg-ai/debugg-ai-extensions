// Generated test script using DebuggAI's browse-to-test open source project
// visit us at https://debugg.ai for more information
// For docs, see https://github.com/debugg-ai/browse-to-test
// To submit an issue or request a feature, please visit https://github.com/debugg-ai/browse-to-test/issues

// Framework: playwright
// Language: typescript
// This script was automatically generated from sequential browser automation data

        
import { test, expect } from '@playwright/test';

test('verify homepage background gradient for light and dark mode', async ({ page }) => {
  // Open the homepage
  await page.goto('https://8b042c1d-6047-47dd-82b7-9a400f78ce28.ngrok.debugg.ai/');

  // Wait for the page to load completely
  await page.waitForLoadState('networkidle');

  // Verify the background gradient for light mode
  const lightGradient = 'linear-gradient(90deg, #2B2DFF 0%, #FFFFFF 50%, #A259FF 100%)';
  const bodyElement = await page.$('body');
  const backgroundStyle = await bodyElement.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('background-image');
  });

  // Check if the background style contains the expected gradient colors for light mode
  const isLightGradientCorrect = backgroundStyle.includes('#2B2DFF') &&
                                 backgroundStyle.includes('#FFFFFF') &&
                                 backgroundStyle.includes('#A259FF');

  expect(isLightGradientCorrect).toBeTruthy();

  // Switch to dark mode
  const darkModeToggle = await page.$('button[aria-label="Toggle dark mode"]');
  if (darkModeToggle) {
    await darkModeToggle.click();
  } else {
    // If there's no toggle button, try to set dark mode via JavaScript
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
  }

  // Wait for the dark mode styles to apply
  await page.waitForTimeout(1000);

  // Verify the background gradient for dark mode
  const darkGradient = 'linear-gradient(90deg, #1E1E1E 0%, #2D2D2D 50%, #3C3C3C 100%)';
  const darkBackgroundStyle = await bodyElement.evaluate((el) => {
    return window.getComputedStyle(el).getPropertyValue('background-image');
  });

  // Check if the background style contains the expected gradient colors for dark mode
  const isDarkGradientCorrect = darkBackgroundStyle.includes('#1E1E1E') &&
                                darkBackgroundStyle.includes('#2D2D2D') &&
                                darkBackgroundStyle.includes('#3C3C3C');

  expect(isDarkGradientCorrect).toBeTruthy();
});
