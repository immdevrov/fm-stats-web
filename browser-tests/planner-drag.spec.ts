import { test, expect, type Locator, type Page } from '@playwright/test';
import type { PlayerPositions } from '../src/fields/positions';
import { seedSettings, seedSnapshots } from './helpers/seed';

const MY_CLUB = 'Test FC';

const WINGER_POSITION: PlayerPositions = [{ type: 'M', side: ['L'] }];

const SEASON = {
  id: 'snap-2036',
  date: '2036-05-01',
  players: [{ uid: 1, name: 'Winger', club: MY_CLUB, position: WINGER_POSITION }],
};

const PLAN = {
  formationId: '4-4-2',
  horizon: null,
  slots: [{ slotId: 'M-L', players: [{ uid: 1, name: 'Winger', club: MY_CLUB }] }],
};

async function dragTo(page: Page, grip: Locator, target: Locator) {
  const from = await grip.boundingBox();
  if (!from) throw new Error('grip missing');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10);
  const live = await target.boundingBox();
  if (!live) throw new Error('target vanished');
  await page.mouse.move(live.x + live.width / 2, live.y + live.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('dragging a marker carries its stack to the new cell', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [SEASON], SEASON.id);
  await seedSettings(page, { myClub: MY_CLUB, squadPlan: PLAN });
  await page.goto('/my-team/planner');

  await expect(page.getByText('Shape: 4-4-2')).toBeVisible();

  await dragTo(page, page.getByLabel('Move M(L) marker'), page.getByLabel('Empty AM(L)'));

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

test('dropping a card on a full slot swaps the two players', async ({ page }) => {
  const names = ['A1', 'A2', 'A3', 'B1'];
  const season = {
    id: 'snap-2036',
    date: '2036-05-01',
    players: names.map((name, i) => ({ uid: i + 1, name, club: MY_CLUB })),
  };
  const planned = (...uids: number[]) =>
    uids.map((uid) => ({ uid, name: names[uid - 1], club: MY_CLUB }));
  const plan = {
    formationId: '4-4-2',
    horizon: null,
    slots: [
      { slotId: 'ST-C-1', players: planned(1, 2, 3) },
      { slotId: 'ST-C-2', players: planned(4) },
    ],
  };

  await page.goto('/import');
  await seedSnapshots(page, [season], season.id);
  await seedSettings(page, { myClub: MY_CLUB, squadPlan: plan });
  await page.goto('/my-team/planner');

  const full = page.locator('[data-slot-id="ST-C-1"]');
  const single = page.locator('[data-slot-id="ST-C-2"]');
  await expect(full.getByText('A2')).toBeVisible();

  await dragTo(page, single.getByLabel('Drag B1'), full.getByText('A2'));

  await expect(full.getByText(/^(A|B)\d$/)).toHaveText(['A1', 'B1', 'A3']);
  await expect(single.getByText(/^(A|B)\d$/)).toHaveText(['A2']);
});

test('dragging a squad player from the panel onto Add places him', async ({ page }) => {
  const season = {
    id: 'snap-2036',
    date: '2036-05-01',
    players: [{ uid: 1, name: 'Striker', club: MY_CLUB }],
  };
  const plan = { formationId: '4-4-2', horizon: null, slots: [] };

  await page.goto('/import');
  await seedSnapshots(page, [season], season.id);
  await seedSettings(page, { myClub: MY_CLUB, squadPlan: plan });
  await page.goto('/my-team/planner');

  const panel = page.getByRole('complementary', { name: 'Candidates' });
  const slot = page.locator('[data-slot-id="ST-C-1"]');
  await expect(panel.getByText('Striker')).toBeVisible();

  await dragTo(page, panel.getByLabel('Drag Striker'), slot.getByText('Nobody'));

  await expect(slot.getByText('Striker')).toBeVisible();
  await expect(panel.getByText('Striker')).toHaveCount(0);
  await expect(panel.getByText('Squad · 0 unplaced')).toBeVisible();
});

test('dropping a panel player on a card in a full slot replaces that card', async ({ page }) => {
  const names = ['A1', 'A2', 'A3', 'C1'];
  const season = {
    id: 'snap-2036',
    date: '2036-05-01',
    players: names.map((name, i) => ({ uid: i + 1, name, club: MY_CLUB })),
  };
  const plan = {
    formationId: '4-4-2',
    horizon: null,
    slots: [
      {
        slotId: 'ST-C-1',
        players: [1, 2, 3].map((uid) => ({ uid, name: names[uid - 1], club: MY_CLUB })),
      },
    ],
  };

  await page.goto('/import');
  await seedSnapshots(page, [season], season.id);
  await seedSettings(page, { myClub: MY_CLUB, squadPlan: plan });
  await page.goto('/my-team/planner');

  const panel = page.getByRole('complementary', { name: 'Candidates' });
  const full = page.locator('[data-slot-id="ST-C-1"]');
  await expect(full.getByText('A2')).toBeVisible();

  await dragTo(page, panel.getByLabel('Drag C1'), full.getByText('A2'));

  await expect(full.getByText(/^(A|C)\d$/)).toHaveText(['A1', 'C1', 'A3']);
  await expect(panel.getByText('A2')).toBeVisible();
  await expect(panel.getByText('C1')).toHaveCount(0);
});

test('while dragging a player, the positions he can play are marked', async ({ page }) => {
  const season = {
    id: 'snap-2036',
    date: '2036-05-01',
    players: [
      {
        uid: 1,
        name: 'Winger',
        club: MY_CLUB,
        position: [
          { type: 'M', side: ['L'] },
          { type: 'AM', side: ['L'] },
        ] as PlayerPositions,
      },
    ],
  };
  const plan = { formationId: '4-4-2', horizon: null, slots: [] };

  await page.goto('/import');
  await seedSnapshots(page, [season], season.id);
  await seedSettings(page, { myClub: MY_CLUB, squadPlan: plan });
  await page.goto('/my-team/planner');

  const panel = page.getByRole('complementary', { name: 'Candidates' });
  const grip = await panel.getByLabel('Drag Winger').boundingBox();
  if (!grip) throw new Error('grip missing');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x - 40, grip.y + 40, { steps: 5 });

  await expect(page.locator('[data-slot-id="M-L"]')).toHaveAttribute('data-hint', 'match');
  await expect(page.locator('[data-slot-id="D-L"]')).toHaveAttribute('data-hint', 'mismatch');
  await expect(page.getByLabel('Empty AM(L)')).toHaveAttribute('data-hint', 'match');
  await expect(page.getByLabel('Empty AM(R)')).not.toHaveAttribute('data-hint', 'match');

  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('[data-slot-id="M-L"]')).not.toHaveAttribute('data-hint', /.*/);
});
