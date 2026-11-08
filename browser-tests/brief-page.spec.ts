import { test, expect } from '@playwright/test';
import { STAT_ABBREVIATIONS } from '../src/utils/scouting-columns';
import {
  seedLeagueRankings,
  seedList,
  seedPlayersAndCompareList,
  seedSettings,
} from './helpers/seed';

test('a brief page ranks every shortlisted player against the cohort, in list order', async ({ page }) => {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();
  await seedPlayersAndCompareList(
    page,
    [
      { uid: 1, name: 'Ann Striker', overrides: { DrbPer90: 1 } },
      { uid: 2, name: 'Bea Striker', overrides: { DrbPer90: 2 } },
      { uid: 3, name: 'Cat Striker', overrides: { DrbPer90: 3 } },
      { uid: 4, name: 'Dee Striker', overrides: { DrbPer90: 4 } },
    ],
    []
  );
  await seedLeagueRankings(page, ['Premier League']);
  await seedList(page, { id: 'l1', name: 'Dribbler targets', uids: [4, 2] });
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
