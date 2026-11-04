import { test, expect } from '@playwright/test';
import { seedAnnotation, seedSettings, seedSnapshots } from './helpers/seed';

const MY_CLUB = 'Test FC';

const SEASON = {
  id: 'snap-2036',
  date: '2036-05-01',
  players: [
    { uid: 1, name: 'Keeper', club: MY_CLUB },
    { uid: 2, name: 'Seller', club: MY_CLUB },
    { uid: 3, name: 'Buyer', club: 'Rivals FC' },
    { uid: 4, name: 'Stranger', club: 'Rivals FC' },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [SEASON], SEASON.id);
  await seedAnnotation(page, { uid: 2, transfer: 'out', lastKnownName: 'Seller' });
  await seedAnnotation(page, { uid: 3, transfer: 'in', lastKnownName: 'Buyer' });
});

test('my team lists the marked squad: arrivals added, departures flagged', async ({ page }) => {
  await seedSettings(page, { myClub: MY_CLUB });
  await page.goto('/my-team');

  await expect(page.getByText('2 players · +1 in · −1 out')).toBeVisible();
  await expect(page.getByText('IN · from Rivals FC')).toBeVisible();
  await expect(page.getByText('OUT', { exact: true })).toBeVisible();
  await expect(page.getByText('Stranger')).toHaveCount(0);
});
