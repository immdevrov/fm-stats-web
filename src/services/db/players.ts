import { getDB, wrapError } from './connection';
import type { Player } from '../../types/types';
import type { PlayerPositions } from '../../fields/positions';

export async function savePlayer(player: Player): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await tx.store.put(player);
    await tx.done;
  } catch (error) {
    throw wrapError('save player', error);
  }
}

export async function savePlayers(players: Player[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await Promise.all(players.map((player) => tx.store.put(player)));
    await tx.done;
  } catch (error) {
    throw wrapError('save players', error);
  }
}

export async function getPlayer(uid: number): Promise<Player | undefined> {
  try {
    const db = await getDB();
    return await db.get('players', uid);
  } catch (error) {
    throw wrapError('get player', error);
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  try {
    const db = await getDB();
    return await db.getAll('players');
  } catch (error) {
    throw wrapError('get players', error);
  }
}

export async function getPlayersByClub(club: string): Promise<Player[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex('players', 'by-club', club);
  } catch (error) {
    throw wrapError('get players by club', error);
  }
}

export async function getPlayersByPosition(position: string): Promise<Player[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex('players', 'by-position', position);
  } catch (error) {
    throw wrapError('get players by position', error);
  }
}

export async function searchPlayersByName(searchTerm: string): Promise<Player[]> {
  try {
    const db = await getDB();
    const allPlayers = await db.getAll('players');
    const lowerSearch = searchTerm.toLowerCase();
    return allPlayers.filter((player) => player.Name.toLowerCase().includes(lowerSearch));
  } catch (error) {
    throw wrapError('search players', error);
  }
}

export async function deletePlayer(uid: number): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('players', uid);
  } catch (error) {
    throw wrapError('delete player', error);
  }
}

export async function clearAllPlayers(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear players', error);
  }
}

export async function getPlayerCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count('players');
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
    const player = await db.get('players', uid);
    if (!player) throw new Error(`Player ${uid} not found`);
    player.CustomPosition = customPosition;
    await db.put('players', player);
  } catch (error) {
    throw wrapError('update player position', error);
  }
}

export async function clearPlayerCustomPosition(uid: number): Promise<void> {
  try {
    const db = await getDB();
    const player = await db.get('players', uid);
    if (!player) throw new Error(`Player ${uid} not found`);
    delete player.CustomPosition;
    await db.put('players', player);
  } catch (error) {
    throw wrapError('clear player custom position', error);
  }
}

export async function clearAllCustomPositions(): Promise<void> {
  try {
    const db = await getDB();
    const allPlayers = await db.getAll('players');
    const withCustom = allPlayers.filter((p) => p.CustomPosition);
    if (withCustom.length === 0) return;
    const tx = db.transaction('players', 'readwrite');
    await Promise.all(
      withCustom.map((p) => {
        delete p.CustomPosition;
        return tx.store.put(p);
      })
    );
    await tx.done;
  } catch (error) {
    throw wrapError('clear custom positions', error);
  }
}
