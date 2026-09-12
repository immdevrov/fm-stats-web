import { test, expect } from '@playwright/test';
import { seedSnapshots } from './helpers/seed';

const OLD = { id: 'snap-2035', date: '2035-01-24', players: [{ uid: 2, name: 'Other Striker' }] };
const NEW = { id: 'snap-2036', date: '2036-05-01', players: [{ uid: 1, name: 'Lone Striker' }] };

test('a player in only one snapshot still gets his history and can rank it', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [OLD, NEW], NEW.id);
  await page.goto('/players/1');

  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '01/05/2036' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rank this row' })).toBeVisible();
});
