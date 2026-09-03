import { test, expect } from '@playwright/test';
import { seedSnapshots } from './helpers/seed';

const BIG = { id: 'big', date: '2035-01-24', players: [{ uid: 1, name: 'Doomed' }] };
const KEEP = { id: 'keep', date: '2036-05-01', players: [{ uid: 2, name: 'Keeper' }] };

// IndexedDB serialises transactions with overlapping scopes, so an open readwrite
// transaction on these stores holds the app's delete at the door for exactly as long
// as we choose. Nothing here depends on how fast a delete happens to run.
async function blockSnapshotWrites(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __releaseLock?: boolean };
    w.__releaseLock = false;
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('fm-stats-db');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['snapshots', 'playerSnapshots'], 'readwrite');
        const store = tx.objectStore('snapshots');
        const spin = () => {
          if (w.__releaseLock) {
            db.close();
            return;
          }
          const keepAlive = store.get('never-used');
          keepAlive.onsuccess = spin;
          keepAlive.onerror = spin;
        };
        spin();
        resolve();
      };
    });
  });
}

async function releaseSnapshotWrites(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as unknown as { __releaseLock?: boolean }).__releaseLock = true;
  });
}

test('a snapshot delete shows progress and cannot be dismissed while it runs', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [BIG, KEEP], KEEP.id);
  await page.goto('/import');

  // Rows sort newest first, so the second one is 24/01/2035.
  await page.getByRole('button', { name: 'Delete' }).last().click();

  await blockSnapshotWrites(page);
  try {
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();

    await expect(page.getByRole('button', { name: 'Deleting…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    // Escape must not dismiss a delete that is already running.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Deleting…' })).toBeVisible();
    await expect(page.locator('p').filter({ hasText: '24/01/2035' })).toBeVisible();
  } finally {
    await releaseSnapshotWrites(page);
  }

  await expect(page.getByText('24/01/2035')).toHaveCount(0);
  await expect(page.getByText('01/05/2036').first()).toBeVisible();
});
