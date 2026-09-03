import { test, expect } from '@playwright/test';
import { seedAnnotation, seedCompareList, seedSnapshots } from './helpers/seed';
import { REQUIRED_COLUMNS } from '../src/parser/html-parser';

async function buildExport(): Promise<string> {
  const values: Record<string, string> = {
    UID: '1', Name: 'Test Player', Age: '25', Nat: 'ENG',
    Division: 'Premier League', Club: 'Test FC', Position: 'ST (C)',
    'Sec. Position': '-', Wage: '10000', Expires: '30/06/2036',
    Height: '180 cm', Weight: '80 kg', 'Rc Injury': '-', Starts: '20',
    Mins: '1800', 'Pas %': '80%', 'xSv %': '0%', 'Sv %': '0%',
  };
  const cells = REQUIRED_COLUMNS.map((c) => `<td>${values[c] ?? '0'}</td>`).join('');
  const headers = REQUIRED_COLUMNS.map((c) => `<th>${c}</th>`).join('');
  return `<html><body><table><tr>${headers}</tr><tr>${cells}</tr></table></body></html>`;
}

const OLD = { id: 'snap-2033', date: '2033-08-10', players: [{ uid: 1, name: 'Early Player' }] };
const MID = { id: 'snap-2035', date: '2035-01-24', players: [{ uid: 1, name: 'Early Player' }, { uid: 2, name: 'Later Player' }] };
const NEW = { id: 'snap-2036', date: '2036-05-01', players: [{ uid: 2, name: 'Later Player' }] };

test('switching the date changes which players the app shows', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [OLD, NEW], NEW.id);
  await page.goto('/players');

  await expect(page.getByText('Later Player')).toBeVisible();
  await expect(page.getByText('Early Player')).toHaveCount(0);

  await page.getByLabel('Data date').selectOption({ label: '10/08/2033' });

  await expect(page.getByText('Early Player')).toBeVisible();
  await expect(page.getByText('Later Player')).toHaveCount(0);
});

test('a historic snapshot is badged and the newest is not', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [OLD, NEW], NEW.id);
  await page.goto('/players');

  await expect(page.getByText('Historic')).toHaveCount(0);
  await page.getByLabel('Data date').selectOption({ label: '10/08/2033' });
  await expect(page.getByText('Historic')).toBeVisible();
});

test('snapshots imported out of order are listed and read by date', async ({ page }) => {
  await page.goto('/import');
  // Seeded in import order 2035, 2036, then a back-filled 2033, with the
  // back-filled one active — as it would be straight after that import.
  await seedSnapshots(page, [MID, NEW, OLD], OLD.id);
  await page.goto('/players');

  const options = await page.getByLabel('Data date').locator('option').allTextContents();
  expect(options).toEqual(['01/05/2036', '24/01/2035', '10/08/2033']);
  await expect(page.getByText('Historic')).toBeVisible();
});

test('a player history lists every snapshot he appears in, newest first', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [MID, NEW, OLD], MID.id);
  await page.goto('/players/1');

  const dates = page.getByRole('row').filter({ hasText: /20\d\d/ });
  await expect(dates.first()).toContainText('24/01/2035');
  await expect(dates.last()).toContainText('10/08/2033');
});

test('the import date is derived from the filename', async ({ page }) => {
  await page.goto('/import');
  await page.setInputFiles('input[type="file"]', {
    name: 'emmen_24_01_2035.html',
    mimeType: 'text/html',
    buffer: Buffer.from(await buildExport()),
  });
  await expect(page.getByPlaceholder('DD/MM/YYYY')).toHaveValue('24/01/2035');
});

async function importOnce(page: import('@playwright/test').Page, mode: 'Same save' | 'New save') {
  await page.setInputFiles('input[type="file"]', {
    name: 'emmen_01_05_2036.html',
    mimeType: 'text/html',
    buffer: Buffer.from(await buildExport()),
  });
  await page.getByText(new RegExp(`^${mode} —`)).click();
  await page.getByRole('button', { name: mode === 'New save' ? 'Erase and import' : 'Import' }).click();
  await expect(page.getByText('Import Successful')).toBeVisible();
}

test('a same-save import keeps annotations and a new-save import erases them', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [{ id: 'seed', date: '2035-01-24', players: [{ uid: 1, name: 'Test Player' }] }], 'seed');
  await seedAnnotation(page, { uid: 1, unwanted: true, lastKnownName: 'Test Player' });

  await page.goto('/import');
  await importOnce(page, 'Same save');
  await page.goto('/lists');
  await expect(page.getByRole('button', { name: 'Unwanted (1)' })).toBeVisible();

  await page.goto('/import');
  await importOnce(page, 'New save');
  await page.goto('/lists');
  await expect(page.getByRole('button', { name: 'Unwanted (0)' })).toBeVisible();
});

test('a compared player missing from the active snapshot is shown, not dropped', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [OLD, MID], OLD.id);
  await seedAnnotation(page, { uid: 2, lastKnownName: 'Later Player' });
  await seedCompareList(page, [1, 2]);

  await page.goto('/compare');

  await expect(page.getByText('Not in this date’s data')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Later Player' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Not in this date’s data')).toBeVisible();
});
