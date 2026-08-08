import { test, expect } from '@playwright/test';
import { seedPlayersAndCompareList } from './helpers/seed';

test('stale compare-list ids left behind by a re-import do not block adding real players', async ({ page }) => {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();

  // Simulate the bug scenario: a compare list left over from a previous
  // roster, referencing two players that no longer exist after a re-import.
  await seedPlayersAndCompareList(
    page,
    [
      { uid: 1, name: 'Alice Striker' },
      { uid: 2, name: 'Bob Striker' },
      { uid: 3, name: 'Carl Striker' },
    ],
    [9991, 9992]
  );

  await page.reload();

  const names = ['Alice Striker', 'Bob Striker', 'Carl Striker'];

  for (const uid of [1, 2, 3]) {
    await page.goto(`/players/${uid}`);
    await page.getByRole('button', { name: 'Add to Compare' }).click();

    // Adding beyond the first player prompts a "go to compare view?" dialog.
    const stayHere = page.getByRole('button', { name: 'Stay Here' });
    if (await stayHere.isVisible().catch(() => false)) {
      await stayHere.click();
    }

    await expect(page.getByRole('button', { name: 'In Compare' })).toBeVisible();
  }

  // All three must still be there together, not just addable one at a time.
  await page.goto('/compare');
  for (const name of names) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
});
