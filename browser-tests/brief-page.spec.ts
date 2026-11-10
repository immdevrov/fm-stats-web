import { test, expect, type Locator, type Page } from '@playwright/test';
import { STAT_ABBREVIATIONS } from '../src/utils/scouting-columns';
import {
  seedLeagueRankings,
  seedList,
  readListUids,
  readSetting,
  readAnnotation,
  seedPlayersAndCompareList,
  seedAnnotation,
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

test('a brief page ranks every shortlisted player against the cohort, in rank order', async ({ page }) => {
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

type StoredPick = { uid: number; grade?: string };

async function storedPicks(page: Page): Promise<StoredPick[] | undefined> {
  const briefs = (await readSetting(page, 'archetypes')) as Array<{ picks?: StoredPick[] }> | null;
  return briefs?.[0]?.picks;
}

async function storedNotes(page: Page, uid: number): Promise<unknown> {
  return (await readAnnotation(page, uid))?.notes;
}

test('a note written on the brief page shows on the profile under that brief and survives a reload', async ({ page }) => {
  await seedDribblerBrief(page);
  await seedAnnotation(page, { uid: 2, notes: [{ id: 'n0', text: 'Seen in pre-season', date: null }] });
  await page.reload();
  await page.goto('/briefs/b1');
  const rows = page.locator('tbody').getByRole('row');
  const bea = rows.filter({ hasText: 'Bea Striker' });
  await bea.getByRole('button', { name: 'Grade for Bea Striker' }).click();
  await page.getByRole('menuitemradio', { name: 'Grade B' }).click();
  await bea.getByRole('button', { name: 'Brief note for Bea Striker' }).click();
  await page.getByRole('textbox', { name: 'Brief note for Bea Striker' }).fill('Quick but raw');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => storedNotes(page, 2))
    .toEqual([
      { id: 'n0', text: 'Seen in pre-season', date: null },
      expect.objectContaining({ text: 'Quick but raw', briefId: 'b1' }),
    ]);
  await expect.poll(async () => (await storedPicks(page))?.find((p) => p.uid === 2)).toEqual({ uid: 2, grade: 'B' });

  await page.reload();
  const beaAfter = page.locator('tbody').getByRole('row').filter({ hasText: 'Bea Striker' });
  await expect(beaAfter.getByRole('button', { name: 'Grade for Bea Striker' })).toHaveText('B');
  await expect(beaAfter.getByRole('button', { name: 'Brief note for Bea Striker' })).toHaveText('Quick but raw');
  const dee = page.locator('tbody').getByRole('row').filter({ hasText: 'Dee Striker' });
  await expect(dee.getByRole('button', { name: 'Grade for Dee Striker' })).toHaveText('–');

  await page.goto('/players/2');
  await expect(page.getByText('Quick but raw')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dribbler', exact: true })).toBeVisible();
});

test('a player removed from the shortlist loses his pick but keeps his note', async ({ page }) => {
  await seedDribblerBrief(page);
  await page.reload();
  await page.goto('/briefs/b1');
  const rows = page.locator('tbody').getByRole('row');
  const dee = rows.filter({ hasText: 'Dee Striker' });
  await dee.getByRole('button', { name: 'Grade for Dee Striker' }).click();
  await page.getByRole('menuitemradio', { name: 'Grade A' }).click();
  await dee.getByRole('button', { name: 'Brief note for Dee Striker' }).click();
  await page.getByRole('textbox', { name: 'Brief note for Dee Striker' }).fill('Plan B');
  await page.keyboard.press('Enter');
  await expect(dee.getByRole('button', { name: 'Grade for Dee Striker' })).toHaveText('A');
  await expect(dee.getByRole('button', { name: 'Brief note for Dee Striker' })).toHaveText('Plan B');
  await expect.poll(async () => (await storedPicks(page))?.some((p) => p.uid === 4)).toBe(true);

  await dee.getByRole('button', { name: 'Remove Dee Striker' }).click();
  await page.getByRole('menuitem', { name: 'Remove from shortlist' }).click();
  await expect(rows).toHaveCount(1);
  await expect.poll(async () => (await storedPicks(page))?.some((p) => p.uid === 4) ?? false).toBe(false);

  await page.goto('/players/4');
  await page.getByRole('button', { name: 'Player status' }).click();
  await page.getByText('Dribbler targets').click();
  await expect.poll(async () => (await readListUids(page, 'l1')).includes(4)).toBe(true);
  await page.goto('/briefs/b1');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('Dee Striker');
  await expect(rows.nth(1).getByRole('button', { name: 'Grade for Dee Striker' })).toHaveText('–');
  await expect(rows.nth(1).getByRole('button', { name: 'Brief note for Dee Striker' })).toHaveText('Plan B');
});

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

test('dragging a row reorders the shortlist and survives a reload; sorting turns dragging off', async ({ page }) => {
  await seedDribblerBrief(page, [], [4, 2, 1]);
  await page.reload();
  await page.goto('/briefs/b1');
  const rows = page.locator('tbody').getByRole('row');
  await expect(page.getByText('Drag rows to reorder.')).toBeVisible();
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Dee Striker');

  await dragTo(page, page.getByLabel('Drag Ann Striker'), rows.filter({ hasText: 'Dee Striker' }));
  await expect(rows.nth(0)).toContainText('Ann Striker');
  await expect(rows.nth(1)).toContainText('Dee Striker');
  await expect(rows.nth(2)).toContainText('Bea Striker');
  await expect.poll(async () => (await storedPicks(page))?.map((p) => p.uid)).toEqual([1, 4, 2]);

  await page.reload();
  await expect(rows.nth(0)).toContainText('Ann Striker');
  await expect(rows.nth(1)).toContainText('Dee Striker');
  await expect(rows.nth(2)).toContainText('Bea Striker');

  await page.getByRole('columnheader', { name: 'Age', exact: true }).click();
  await expect(page.getByLabel('Drag Ann Striker')).toHaveCount(0);
  await expect(page.getByText('Sorted by Age — sort by rank to reorder', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'sort by rank' }).click();
  await expect(page.getByText('Drag rows to reorder.')).toBeVisible();
});

test('who beats whom compares the hovered or pinned player on the brief stats only', async ({ page }) => {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();
  await seedPlayersAndCompareList(
    page,
    [
      { uid: 1, name: 'Ann Striker', overrides: { DrbPer90: 1, ShTPer90: 1, ChCPer90: 5 } },
      { uid: 2, name: 'Bea Striker', overrides: { DrbPer90: 2, ShTPer90: 4 } },
      { uid: 3, name: 'Cat Striker', overrides: { DrbPer90: 3, ShTPer90: 3 } },
      { uid: 4, name: 'Dee Striker', overrides: { DrbPer90: 4, ShTPer90: 5 } },
    ],
    []
  );
  await seedLeagueRankings(page, ['Premier League']);
  await seedList(page, { id: 'l1', name: 'Targets', uids: [1, 2, 3, 4] });
  await seedSettings(page, {
    archetypes: [
      {
        id: 'b1',
        name: 'Runner',
        listId: 'l1',
        filters: {
          roleKey: 'ST',
          side: 'both',
          columnFilters: { stat_dribbles: { min: '0' }, stat_shots: { min: '0' } },
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
  await page.goto('/briefs/b1');
  const rows = page.locator('tbody').getByRole('row');
  const row = (name: string) => rows.filter({ hasText: name });
  await expect(rows).toHaveCount(4);

  await page.getByText('Who beats whom').click();
  await row('Cat Striker').getByRole('cell').nth(3).hover();
  await expect(page.getByText('Cat Striker beats 1, beaten by 1.')).toBeVisible();
  await expect(row('Ann Striker')).toHaveAttribute('data-dominance', 'beats');
  await expect(row('Dee Striker')).toHaveAttribute('data-dominance', 'beaten-by');
  await expect(row('Bea Striker')).not.toHaveAttribute('data-dominance');

  await row('Cat Striker').getByRole('cell').nth(3).click();
  await row('Dee Striker').getByRole('cell').nth(3).hover();
  await expect(page.getByText('Cat Striker beats 1, beaten by 1.')).toBeVisible();

  await page.keyboard.press('Escape');
  await row('Dee Striker').getByRole('cell').nth(4).hover();
  await expect(page.getByText('Dee Striker beats 3, beaten by 0.')).toBeVisible();
  await expect(row('Bea Striker')).toHaveAttribute('data-dominance', 'beats');
});

test('a price and wage demand set on the profile show in the brief table', async ({ page }) => {
  await seedDribblerBrief(page, [], [4, 2, 9]);
  await seedAnnotation(page, { uid: 9, lastKnownName: 'Gone Striker', price: 3000000, wageDemand: 20000 });
  await page.reload();
  await page.goto('/players/2');
  const field = (label: string) =>
    page.getByText(label, { exact: true }).locator('..').getByRole('textbox');
  await field('Price').fill('12m');
  await expect(page.getByText('= 12.000.000 €')).toBeVisible();
  await field('Wage demand').fill('45,5k');
  await field('Wage demand').blur();
  await expect(field('Price')).toHaveValue('12M €');

  await page.getByRole('link', { name: 'Briefs', exact: true }).click();
  await page.getByRole('link', { name: 'Dribbler', exact: true }).click();
  const headers = page.locator('thead').getByRole('columnheader');
  await expect(headers.filter({ hasText: /^Wage demand/ })).toBeVisible();
  const headerTexts = await headers.allTextContents();
  const priceColumn = headerTexts.findIndex((t) => t.startsWith('Price'));
  const demandColumn = headerTexts.findIndex((t) => t.startsWith('Wage demand'));
  const cells = (name: string) =>
    page.locator('tbody').getByRole('row').filter({ hasText: name }).getByRole('cell');

  await expect(cells('Bea Striker').nth(priceColumn)).toHaveText('12M €');
  await expect(cells('Bea Striker').nth(demandColumn)).toHaveText('45.5K €');
  await expect(cells('Dee Striker').nth(priceColumn)).toHaveText('');
  await expect(cells('Gone Striker').nth(priceColumn)).toHaveText('3M €');
  await expect(cells('Gone Striker').nth(demandColumn)).toHaveText('20K €');

  const order = page.locator('tbody').getByRole('row').filter({ hasText: /Striker/ });
  await headers.filter({ hasText: /^Price/ }).click();
  await expect(order).toHaveText([/Bea Striker/, /Gone Striker/, /Dee Striker/]);
  await headers.filter({ hasText: /^Price/ }).click();
  await expect(order).toHaveText([/Gone Striker/, /Bea Striker/, /Dee Striker/]);
});
