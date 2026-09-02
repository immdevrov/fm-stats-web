import { getDB, wrapError } from './connection';
import { getActiveSnapshotId, getSnapshotRoster, getSnapshotPlayer } from './snapshots';
import type { Player } from '../../types/types';
import type { PlayerPositions } from '../../fields/positions';

async function withCustomPositions(players: Player[]): Promise<Player[]> {
  if (players.length === 0) return players;
  const db = await getDB();
  const annotations = await db.getAll('playerAnnotations');
  const byUid = new Map(
    annotations
      .filter((a) => a.customPosition)
      .map((a) => [a.uid, a.customPosition as PlayerPositions])
  );
  if (byUid.size === 0) return players;
  return players.map((player) => {
    const customPosition = byUid.get(player.UID);
    return customPosition ? { ...player, CustomPosition: customPosition } : player;
  });
}

async function activeRoster(): Promise<Player[]> {
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return [];
  return await withCustomPositions(await getSnapshotRoster(snapshotId));
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

export async function getPlayersByClub(club: string): Promise<Player[]> {
  try {
    return (await activeRoster()).filter((player) => player.Club === club);
  } catch (error) {
    throw wrapError('get players by club', error);
  }
}

export async function getPlayersByPosition(position: string): Promise<Player[]> {
  try {
    return (await activeRoster()).filter((player) =>
      player.Position.some((entry) => entry.type === position)
    );
  } catch (error) {
    throw wrapError('get players by position', error);
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
    const existing = await db.get('playerAnnotations', uid);
    await db.put('playerAnnotations', {
      ...existing,
      uid,
      customPosition,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });
  } catch (error) {
    throw wrapError('update player position', error);
  }
}

export async function clearPlayerCustomPosition(uid: number): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('playerAnnotations', uid);
    if (!existing) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customPosition: _removed, ...rest } = existing;
    await db.put('playerAnnotations', rest);
  } catch (error) {
    throw wrapError('clear player custom position', error);
  }
}

export async function clearAllCustomPositions(): Promise<void> {
  try {
    const db = await getDB();
    const annotations = await db.getAll('playerAnnotations');
    const withCustom = annotations.filter((a) => a.customPosition);
    if (withCustom.length === 0) return;
    const tx = db.transaction('playerAnnotations', 'readwrite');
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      withCustom.map(({ customPosition: _removed, ...rest }) => tx.store.put(rest))
    );
    await tx.done;
  } catch (error) {
    throw wrapError('clear custom positions', error);
  }
}
