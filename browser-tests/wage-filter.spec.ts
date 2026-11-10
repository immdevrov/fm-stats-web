import { test, expect } from '@playwright/test';
import { seedLeagueRankings, seedPlayersAndCompareList } from './helpers/seed';

test('the scouting wage filter takes shorthand amounts and filters on the raw wage', async ({ page }) => {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();
  await seedPlayersAndCompareList(
    page,
    [
      { uid: 1, name: 'Alice Striker', overrides: { Wage: 950000 } },
      { uid: 2, name: 'Bob Striker', overrides: { Wage: 1200000 } },
      { uid: 3, name: 'Cid Striker', overrides: { Wage: 40000 } },
    ],
    []
  );
  await seedLeagueRankings(page, ['Premier League']);
  await page.reload();
  await page.goto('/scouting');
  await page.getByRole('button', { name: 'Striker', exact: true }).click();
  await expect(page.getByText('Bob Striker')).toBeVisible();

  await page.getByRole('button', { name: 'Filter wage' }).click();
  await page.getByPlaceholder('min').filter({ visible: true }).fill('50k');
  await page.getByPlaceholder('max').filter({ visible: true }).fill('1,1m');
  await expect(page.getByText('= 1.100.000 €')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByText('Alice Striker')).toBeVisible();
  await expect(page.getByText('Bob Striker')).toHaveCount(0);
  await expect(page.getByText('Cid Striker')).toHaveCount(0);
});
