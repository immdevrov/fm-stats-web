import { test, expect } from '@playwright/test';
import { readSetting, seedLeagueRankings, seedList, seedPlayersAndCompareList } from './helpers/seed';

test('an archetype links a shortlist, pins players to it and is unlinked when the list is deleted', async ({ page }) => {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();
  await seedPlayersAndCompareList(
    page,
    [
      { uid: 1, name: 'Alice Striker' },
      { uid: 2, name: 'Bob Striker' },
      { uid: 3, name: 'Carol Striker' },
    ],
    []
  );
  await seedLeagueRankings(page, ['Premier League']);
  await seedList(page, { id: 'other', name: 'Other', uids: [] });
  await page.reload();
  await page.goto('/scouting');
  await page.getByRole('button', { name: 'Striker', exact: true }).click();
  await expect(page.getByText('Alice Striker')).toBeVisible();

  await page.getByRole('button', { name: 'Save as archetype' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Poacher');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Archetype actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Link list…' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Link list…' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Poacher targets');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByText('→ Poacher targets')).toBeVisible();

  const pin = (name: string) => page.getByRole('button', { name: `Pin ${name}` });
  await pin('Alice Striker').click();
  await pin('Bob Striker').click();
  await expect(pin('Bob Striker')).toHaveAttribute('aria-pressed', 'true');
  await pin('Bob Striker').click();
  await expect(pin('Bob Striker')).toHaveAttribute('aria-pressed', 'false');
  await expect(pin('Alice Striker')).toHaveAttribute('aria-pressed', 'true');

  await expect(page.getByText('Bob Striker')).toBeVisible();
  await expect(page.getByText('Carol Striker')).toBeVisible();
  await page.getByText('Shortlist only').click();
  await expect(page.getByText('Alice Striker')).toBeVisible();
  await expect(page.getByText('Bob Striker')).toHaveCount(0);
  await expect(page.getByText('Carol Striker')).toHaveCount(0);

  await page.goto('/lists');
  await page.getByRole('button', { name: 'Poacher targets (1)' }).click();
  await expect(page.getByText('Alice Striker')).toBeVisible();
  await expect(page.getByText('Bob Striker')).toHaveCount(0);

  let confirmText = '';
  page.once('dialog', (dialog) => {
    confirmText = dialog.message();
    dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete list' }).click();
  await expect(page.getByRole('button', { name: /Poacher targets/ })).toHaveCount(0);
  expect(confirmText).toContain('shortlist of Poacher');

  await expect
    .poll(async () => {
      const stored = (await readSetting(page, 'archetypes')) as Array<{ name: string; listId?: string }>;
      return stored.find((a) => a.name === 'Poacher')?.listId ?? null;
    })
    .toBeNull();

  await page.goto('/scouting');
  await expect(page.getByRole('button', { name: 'Poacher' })).toBeVisible();
  await page.getByRole('button', { name: 'Archetype actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Link list…' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Alice Striker')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pin / })).toHaveCount(0);
  await expect(page.getByText('Shortlist only')).toHaveCount(0);
});
