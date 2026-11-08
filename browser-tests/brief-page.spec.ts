import { test, expect, type Page } from '@playwright/test';
import { STAT_ABBREVIATIONS } from '../src/utils/scouting-columns';
import {
  seedLeagueRankings,
  seedList,
  seedPlayersAndCompareList,
  seedSettings,
} from './helpers/seed';

async function seedDribblerBrief(
  page: Page,
  extraPlayers: Array<{ uid: number; name: string; overrides?: Record<string, unknown> }> = [],
  listUids = [4, 2]
) {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();
  await seedPlayersAndCompareList(
    page,
    [
      { uid: 1, name: 'Ann Striker', overrides: { DrbPer90: 1 } },
      { uid: 2, name: 'Bea Striker', overrides: { DrbPer90: 2 } },
      { uid: 3, name: 'Cat Striker', overrides: { DrbPer90: 3 } },
      { uid: 4, name: 'Dee Striker', overrides: { DrbPer90: 4 } },
      ...extraPlayers,
    ],
    []
  );
  await seedLeagueRankings(page, ['Premier League']);
  await seedList(page, { id: 'l1', name: 'Dribbler targets', uids: listUids });
  await seedSettings(page, {
    archetypes: [
      {
        id: 'b1',
        name: 'Dribbler',
        listId: 'l1',
        filters: {
          roleKey: 'ST',
          side: 'both',
          columnFilters: { stat_dribbles: { min: '50' } },
          contractHorizon: null,
          excludeInjuries: true,
          excludedLeagues: [],
          sortKey: 'name',
          sortDirection: 'asc',
        },
      },
    ],
  });
}

test('a brief page ranks every shortlisted player against the cohort, in list order', async ({ page }) => {
  await seedDribblerBrief(page);
  await page.reload();
  await page.goto('/briefs');
  await page.getByRole('link', { name: 'Dribbler', exact: true }).click();

  await expect(page.getByText(`${STAT_ABBREVIATIONS.dribbles} ≥ 50`)).toBeVisible();
  const rows = page.locator('tbody').getByRole('row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Dee Striker');
  await expect(rows.nth(1)).toContainText('Bea Striker');
  await expect(rows.nth(0).getByLabel('Dribbles: 88', { exact: true })).toBeVisible();
  await expect(rows.nth(1).getByLabel('Dribbles: 38', { exact: true })).toBeVisible();
  await expect(page.getByText('Cat Striker')).toHaveCount(0);
});

test('adding an out-of-cohort player to a brief list warns, and he does not join the cohort', async ({ page }) => {
  await seedDribblerBrief(page, [{ uid: 5, name: 'Eve Striker', overrides: { Mins: 600, DrbPer90: 3.5 } }], [4]);
  await page.reload();
  await page.goto('/players/5');
  await page.getByRole('button', { name: 'Player status' }).click();
  await page.getByText('Dribbler targets').click();
  await expect(page.getByText("Outside a brief's cohort")).toBeVisible();
  await expect(page.getByText(/Dribbler: 600 minutes/)).toBeVisible();

  await page.goto('/briefs/b1');
  const rows = page.locator('tbody').getByRole('row');
  await expect(rows).toHaveCount(2);
  const eve = rows.filter({ hasText: 'Eve Striker' });
  await expect(eve).toContainText('600 min');
  await expect(eve.getByLabel('Dribbles: 75', { exact: true })).toBeVisible();
  await expect(rows.filter({ hasText: 'Dee Striker' }).getByLabel('Dribbles: 88', { exact: true })).toBeVisible();
});
