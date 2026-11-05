import { test, expect } from '@playwright/test';
import { seedSettings, seedSnapshots } from './helpers/seed';

const MY_CLUB = 'Test FC';

const SEASON = {
  id: 'snap-2036',
  date: '2036-05-01',
  players: [
    { uid: 1, name: 'Winger', club: MY_CLUB, position: [{ type: 'M', side: ['L'] }] as never },
  ],
};

const PLAN = {
  formationId: '4-4-2',
  horizon: null,
  slots: [{ slotId: 'M-L', players: [{ uid: 1, name: 'Winger', club: MY_CLUB }] }],
};

test('dragging a marker carries its stack to the new cell', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [SEASON], SEASON.id);
  await seedSettings(page, { myClub: MY_CLUB, squadPlan: PLAN });
  await page.goto('/my-team/planner');

  await expect(page.getByText('Shape: 4-4-2')).toBeVisible();

  const grip = await page.getByLabel('Move M(L) marker').boundingBox();
  if (!grip) throw new Error("grip missing");

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 10, grip.y + grip.height / 2 + 10);
  const live = await page.getByLabel('Empty AM(L)').boundingBox();
  if (!live) throw new Error('target vanished');
  await page.mouse.move(live.x + live.width / 2, live.y + live.height / 2, { steps: 10 });
  await page.mouse.up();

  const verify = async () => {
    await expect(page.getByText('Shape: 4-3-1-2')).toBeVisible();
    await expect(page.getByLabel('Move AM(L) marker')).toBeVisible();
    await expect(page.getByText('Winger').first()).toBeVisible();
    await expect(page.getByText('not an AM(L)')).toBeVisible();
  };
  await verify();
  await page.reload();
  await verify();
});
