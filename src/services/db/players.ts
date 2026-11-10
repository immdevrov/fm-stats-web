import { getDB, wrapError } from './connection';
import { getActiveSnapshotId, getSnapshotRoster, getSnapshotPlayer } from './snapshots';
import { withCustomPositions } from './custom-positions';
import type { Player } from '../../types/types';
import type { PlayerPositions } from '../../fields/positions';

async function activeRoster(): Promise<Player[]> {
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return [];
  return await getSnapshotRoster(snapshotId);
}

export async function getAllPlayers(): Promise<Player[]> {
  try {
    return await activeRoster();
  } catch (error) {
    throw wrapError('get players', error);
  }
}

export async function getPlayer(uid: number): Promise<Player | undefined> {
  try {
    const snapshotId = await getActiveSnapshotId();
    if (!snapshotId) return undefined;
    const player = await getSnapshotPlayer(snapshotId, uid);
    if (!player) return undefined;
    const [merged] = await withCustomPositions([player]);
    return merged;
  } catch (error) {
    throw wrapError('get player', error);
  }
}

export async function searchPlayersByName(searchTerm: string): Promise<Player[]> {
  try {
    const lowerSearch = searchTerm.toLowerCase();
    return (await activeRoster()).filter((player) =>
      player.Name.toLowerCase().includes(lowerSearch)
    );
  } catch (error) {
    throw wrapError('search players', error);
  }
}

export async function getPlayerCount(): Promise<number> {
  try {
    return (await activeRoster()).length;
  } catch (error) {
    throw wrapError('get player count', error);
  }
}

export async function updatePlayerPosition(
  uid: number,
  customPosition: PlayerPositions
): Promise<void> {
  try {
    const db = await getDB();
    const player = await getPlayer(uid);
    const tx = db.transaction('playerAnnotations', 'readwrite');
    const existing = await tx.store.get(uid);
    await tx.store.put({
      ...existing,
      uid,
      customPosition,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });
    await tx.done;
  } catch (error) {
    throw wrapError('update player position', error);
  }
}

export async function clearPlayerCustomPosition(uid: number): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerAnnotations', 'readwrite');
    const existing = await tx.store.get(uid);
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { customPosition: _removed, ...rest } = existing;
      await tx.store.put(rest);
    }
    await tx.done;
  } catch (error) {
    throw wrapError('clear player custom position', error);
  }
}

export async function clearAllCustomPositions(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerAnnotations', 'readwrite');
    const annotations = await tx.store.getAll();
    const withCustom = annotations.filter((a) => a.customPosition);
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      withCustom.map(({ customPosition: _removed, ...rest }) => tx.store.put(rest))
    );
    await tx.done;
  } catch (error) {
    throw wrapError('clear custom positions', error);
  }
}
