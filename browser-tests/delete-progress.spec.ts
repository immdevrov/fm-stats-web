import { test, expect } from '@playwright/test';
import { seedSnapshots } from './helpers/seed';

test('deleting a big snapshot shows progress and blocks cancel', async ({ page }) => {
  const many = Array.from({ length: 6000 }, (_, i) => ({ uid: i + 1, name: `P${i}` }));
  await page.goto('/import');
  await seedSnapshots(
    page,
    [
      { id: 'big', date: '2035-01-24', players: many },
      { id: 'keep', date: '2036-05-01', players: [{ uid: 999999, name: 'Keeper' }] },
    ],
    'keep'
  );
  await page.goto('/import');

  // Rows sort newest first, so the 6k-row snapshot is the second one.
  await page.getByRole('button', { name: 'Delete' }).last().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();

  await expect(page.getByRole('button', { name: 'Deleting…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();

  await expect(page.getByText('24/01/2035')).toHaveCount(0);
});
