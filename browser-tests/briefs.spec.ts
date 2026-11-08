import { test, expect, type Page } from '@playwright/test';
import { seedLeagueRankings, seedPlayersAndCompareList } from './helpers/seed';

async function setAgeMin(page: Page, value: string) {
  await page.getByRole('button', { name: 'Filter age' }).click();
  await page.getByPlaceholder('min').filter({ visible: true }).fill(value);
  await page.keyboard.press('Escape');
}

async function expectAgeMin(page: Page, value: string) {
  await page.getByRole('button', { name: 'Filter age' }).click();
  await expect(page.getByPlaceholder('min').filter({ visible: true })).toHaveValue(value);
  await page.keyboard.press('Escape');
}

test('a brief saves a scouting search, reverts edits and comes back after leaving it', async ({ page }) => {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();
  await seedPlayersAndCompareList(
    page,
    [
      { uid: 1, name: 'Alice Striker' },
      { uid: 2, name: 'Bob Striker' },
    ],
    []
  );
  await seedLeagueRankings(page, ['Premier League']);
  await page.reload();
  await page.goto('/scouting');
  await page.getByRole('button', { name: 'Striker', exact: true }).click();
  await expect(page.getByText('Alice Striker')).toBeVisible();

  await setAgeMin(page, '18');
  await page.getByRole('button', { name: 'Save as brief' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Poacher');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Poacher' })).toBeVisible();
  await expect(page.getByText('modified')).toHaveCount(0);

  await setAgeMin(page, '30');
  await expect(page.getByText('modified')).toBeVisible();
  await page.getByRole('button', { name: 'Revert' }).click();
  await expect(page.getByText('modified')).toHaveCount(0);
  await expectAgeMin(page, '18');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Poacher' })).toBeVisible();

  await page.getByRole('button', { name: 'Winger', exact: true }).click();
  await expect(page.getByRole('button', { name: 'No brief' })).toBeVisible();
  await page.getByRole('button', { name: 'No brief' }).click();
  await page.getByRole('menuitem', { name: 'Poacher' }).click();
  await expect(page).toHaveTitle(/Scouting: Striker/);
  await expect(page.getByText('Alice Striker')).toBeVisible();
  await expectAgeMin(page, '18');
});
