import { getDB, wrapError, generateSnapshotId } from './connection';
import { _getStoredActiveSnapshot, setActiveSnapshotId } from './settings';
import { PLAYER_FIELDS, pack, unpack } from './pack';
import { sortSnapshots, newestSnapshot } from '../../utils/snapshot-order';
import type { Player } from '../../types/types';
import type { Snapshot, PlayerHistoryEntry } from '../../types/snapshot';

const CHUNK_SIZE = 2000;

function rosterRange(snapshotId: string): IDBKeyRange {
  // Upper bound [snapshotId, []] works because IndexedDB orders numbers before arrays,
  // so [] sorts above every real uid and this bounds the full range for the snapshot.
  return IDBKeyRange.bound([snapshotId], [snapshotId, []]);
}

export async function listSnapshots(): Promise<Snapshot[]> {
  try {
    const db = await getDB();
    return sortSnapshots(await db.getAll('snapshots'));
  } catch (error) {
    throw wrapError('list snapshots', error);
  }
}

export async function createSnapshot(
  players: Player[],
  meta: { date: string; label?: string | null },
  onProgress?: (written: number, total: number) => void
): Promise<string> {
  try {
    const db = await getDB();
    const id = generateSnapshotId();
    const fields = [...PLAYER_FIELDS];

    for (let start = 0; start < players.length; start += CHUNK_SIZE) {
      const chunk = players.slice(start, start + CHUNK_SIZE);
      const tx = db.transaction('playerSnapshots', 'readwrite');
      await Promise.all(
        chunk.map((player) =>
          tx.store.put({ s: id, u: player.UID, v: pack(player, fields) })
        )
      );
      await tx.done;
      onProgress?.(Math.min(start + CHUNK_SIZE, players.length), players.length);
    }

    await db.put('snapshots', {
      id,
      date: meta.date,
      label: meta.label ?? null,
      playerCount: players.length,
      importedAt: Date.now(),
      fields,
    });

    return id;
  } catch (error) {
    throw wrapError('create snapshot', error);
  }
}

export async function getSnapshotRoster(snapshotId: string): Promise<Player[]> {
  try {
    const db = await getDB();
    const snapshot = await db.get('snapshots', snapshotId);
    if (!snapshot) return [];
    const rows = await db.getAll('playerSnapshots', rosterRange(snapshotId));
    return rows.map((row) => unpack(row.u, row.v, snapshot.fields));
  } catch (error) {
    throw wrapError('get snapshot roster', error);
  }
}

export async function getSnapshotPlayer(
  snapshotId: string,
  uid: number
): Promise<Player | undefined> {
  try {
    const db = await getDB();
    const snapshot = await db.get('snapshots', snapshotId);
    if (!snapshot) return undefined;
    const row = await db.get('playerSnapshots', [snapshotId, uid]);
    return row ? unpack(row.u, row.v, snapshot.fields) : undefined;
  } catch (error) {
    throw wrapError('get snapshot player', error);
  }
}

export async function purgeOrphanedRows(): Promise<number> {
  try {
    const db = await getDB();
    const known = new Set((await db.getAll('snapshots')).map((snapshot) => snapshot.id));
    let removed = 0;
    const tx = db.transaction('playerSnapshots', 'readwrite');
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (!known.has(cursor.value.s)) {
        await cursor.delete();
        removed++;
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    return removed;
  } catch (error) {
    throw wrapError('purge orphaned rows', error);
  }
}

export async function getPlayerHistory(uid: number): Promise<PlayerHistoryEntry[]> {
  try {
    const db = await getDB();
    const rows = await db.getAllFromIndex('playerSnapshots', 'by-uid', uid);
    const snapshots = new Map((await db.getAll('snapshots')).map((s) => [s.id, s]));

    const entries: PlayerHistoryEntry[] = [];
    for (const row of rows) {
      const snapshot = snapshots.get(row.s);
      if (!snapshot) continue;
      entries.push({ snapshot, player: unpack(row.u, row.v, snapshot.fields) });
    }

    const order = new Map(sortSnapshots([...snapshots.values()]).map((s, i) => [s.id, i]));
    return entries.sort((a, b) => order.get(a.snapshot.id)! - order.get(b.snapshot.id)!);
  } catch (error) {
    throw wrapError('get player history', error);
  }
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(['snapshots', 'playerSnapshots'], 'readwrite');
    let cursor = await tx.objectStore('playerSnapshots').openCursor(rosterRange(snapshotId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.objectStore('snapshots').delete(snapshotId);
    await tx.done;

    if ((await _getStoredActiveSnapshot()) === snapshotId) {
      await setActiveSnapshotId(newestSnapshot(await db.getAll('snapshots'))?.id ?? null);
    }
  } catch (error) {
    throw wrapError('delete snapshot', error);
  }
}

export async function updateSnapshot(
  snapshotId: string,
  patch: Partial<Pick<Snapshot, 'date' | 'label'>>
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('snapshots', snapshotId);
    if (!existing) return;
    await db.put('snapshots', { ...existing, ...patch });
  } catch (error) {
    throw wrapError('update snapshot', error);
  }
}

export async function getActiveSnapshotId(): Promise<string | null> {
  try {
    const db = await getDB();
    const all = await db.getAll('snapshots');
    if (all.length === 0) return null;

    const stored = await _getStoredActiveSnapshot();
    if (stored && all.some((snapshot) => snapshot.id === stored)) return stored;

    const fallback = newestSnapshot(all)?.id ?? null;
    await setActiveSnapshotId(fallback);
    return fallback;
  } catch (error) {
    throw wrapError('get active snapshot', error);
  }
}

export async function clearAllSnapshots(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(['snapshots', 'playerSnapshots'], 'readwrite');
    await Promise.all([tx.objectStore('snapshots').clear(), tx.objectStore('playerSnapshots').clear()]);
    await tx.done;
    await setActiveSnapshotId(null);
  } catch (error) {
    throw wrapError('clear snapshots', error);
  }
}
