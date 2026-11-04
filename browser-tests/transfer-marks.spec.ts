import { test, expect } from '@playwright/test';
import { seedAnnotation, seedList, seedSettings, seedSnapshots } from './helpers/seed';

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

test('the planner treats a leaving player as gone and offers the arriving one', async ({ page }) => {
  await seedSettings(page, {
    myClub: MY_CLUB,
    squadPlan: {
      formationId: '4-4-2',
      horizon: null,
      slots: [{ slotId: 'ST-C-1', players: [{ uid: 2, name: 'Seller', club: MY_CLUB }] }],
    },
  });
  await seedList(page, { id: 'keep', name: 'Keep', uids: [2] });
  await page.goto('/my-team/planner');

  await expect(page.getByText('1 no longer in the squad')).toBeVisible();
  await expect(page.getByLabel('No longer in the squad')).toHaveCount(1);
  await page.getByLabel('No longer in the squad').hover();
  await expect(page.getByText('Marked as leaving')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buyer' })).toBeVisible();
  await expect(page.locator('[id^="popover:"]').getByText('Buyer').first()).toBeAttached();
  await expect(page.locator('[id^="popover:"]').getByText('Seller')).toHaveCount(0);
});
