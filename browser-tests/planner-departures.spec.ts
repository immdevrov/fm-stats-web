import { test, expect } from '@playwright/test';
import { seedList, seedSettings, seedSnapshots } from './helpers/seed';

const MY_CLUB = 'Test FC';

// Three strikers placed on the board: one still at the club, one sold and on no
// list, one sold but shortlisted. Only the second has left the squad.
const SEASON = {
  id: 'snap-2036',
  date: '2036-05-01',
  players: [
    { uid: 1, name: 'Stayed', club: MY_CLUB },
    { uid: 2, name: 'Sold', club: 'Rivals FC' },
    { uid: 3, name: 'Shortlisted', club: 'Rivals FC' },
  ],
};

const PLAN = {
  formationId: '4-4-2',
  horizon: null,
  slots: [
    {
      slotId: 'ST-C-1',
      players: [
        { uid: 1, name: 'Stayed', club: MY_CLUB },
        { uid: 2, name: 'Sold', club: MY_CLUB },
        { uid: 3, name: 'Shortlisted', club: 'Rivals FC' },
      ],
    },
  ],
};

test('a player who left the club is flagged, a shortlisted outsider is not', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [SEASON], SEASON.id);
  await seedSettings(page, { myClub: MY_CLUB, squadPlan: PLAN });
  await seedList(page, { id: 'targets', name: 'Targets', uids: [3] });

  await page.goto('/my-team/planner');


  await expect(page.getByText('1 no longer in the squad')).toBeVisible();

  // Only the sold player is flagged — the shortlisted outsider is at another club too.
  await expect(page.getByLabel('No longer in the squad')).toHaveCount(1);
  await page.getByLabel('No longer in the squad').hover();
  await expect(page.getByText(`No longer at ${MY_CLUB} — now at Rivals FC`)).toBeVisible();

  await page.getByRole('button', { name: 'Remove missing' }).click();

  await expect(page.getByText('Sold')).toHaveCount(0);
  await expect(page.getByLabel('No longer in the squad')).toHaveCount(0);
  await expect(page.getByText('no longer in the squad')).toHaveCount(0);
  await expect(page.getByText('Stayed').first()).toBeVisible();
  await expect(page.getByText('Shortlisted').first()).toBeVisible();
});
