import { getDB } from './connection';
import type { Player } from '../../types/types';
import type { PlayerPositions } from '../../fields/positions';

export type CustomPositionMap = Map<number, PlayerPositions>;

export async function loadCustomPositions(): Promise<CustomPositionMap> {
  const db = await getDB();
  const annotations = await db.getAll('playerAnnotations');
  return new Map(
    annotations
      .filter((a) => a.customPosition)
      .map((a) => [a.uid, a.customPosition as PlayerPositions])
  );
}

export function applyCustomPosition(player: Player, byUid: CustomPositionMap): Player {
  const customPosition = byUid.get(player.UID);
  return customPosition ? { ...player, CustomPosition: customPosition } : player;
}

export async function withCustomPositions(players: Player[]): Promise<Player[]> {
  if (players.length === 0) return players;
  const byUid = await loadCustomPositions();
  if (byUid.size === 0) return players;
  return players.map((player) => applyCustomPosition(player, byUid));
}
