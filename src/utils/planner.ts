import type { FormationSlot } from '../formations';
import type { PlayerPosition, PlayerPositions } from '../fields/positions';
import type { SquadPlan } from '../types/planner';
import { formatPositions, getEffectivePosition, parseCustomDate } from './utils';

export type PositionedPlayer = { Position: PlayerPositions; CustomPosition?: PlayerPositions };

export interface Placement {
  slotId: string;
  rank: number;
}

export type PlacementIndex = Map<number, Placement[]>;

function sideMatches(slotSide: PlayerPosition['side'], playerSide: PlayerPosition['side']): boolean {
  if (!slotSide?.length || !playerSide?.length) return true;
  return slotSide.every((side) => playerSide.includes(side));
}

export function matchesSlot(player: PositionedPlayer, slot: FormationSlot): boolean {
  return getEffectivePosition(player).some(
    (position) =>
      position.type === slot.position.type && sideMatches(slot.position.side, position.side)
  );
}

export function slotLabel(slot: FormationSlot): string {
  return formatPositions([slot.position]);
}

const AN_BEFORE = /^[AEFHILMNORSX]/;
const SIDE_WORDS: Record<string, string> = { L: 'left', R: 'right', C: 'centre' };

export function describeMismatch(player: PositionedPlayer, slot: FormationSlot): string | null {
  if (matchesSlot(player, slot)) return null;

  const sameType = getEffectivePosition(player).filter(
    (position) => position.type === slot.position.type
  );

  if (sameType.length === 0) {
    const article = AN_BEFORE.test(slot.position.type) ? 'an' : 'a';
    return `not ${article} ${slotLabel(slot)}`;
  }

  const sides = [...new Set(sameType.flatMap((position) => position.side ?? []))];
  const words = sides.map((side) => SIDE_WORDS[side] ?? side);
  return `${words.join(' and ')} ${words.length > 1 ? 'sides' : 'side'} only`;
}

export function buildPlacementIndex(plan: SquadPlan | null): PlacementIndex {
  const index: PlacementIndex = new Map();
  if (!plan) return index;

  for (const slot of plan.slots) {
    slot.players.forEach((player, rank) => {
      const existing = index.get(player.uid);
      if (existing) existing.push({ slotId: slot.slotId, rank });
      else index.set(player.uid, [{ slotId: slot.slotId, rank }]);
    });
  }

  return index;
}

export function placementFacts(
  placements: PlacementIndex,
  uid: number,
  slotId: string
): { elsewhere: Placement[]; firstChoiceCount: number } {
  const all = placements.get(uid) ?? [];
  return {
    elsewhere: all.filter((placement) => placement.slotId !== slotId),
    firstChoiceCount: all.filter((placement) => placement.rank === 0).length,
  };
}

export function countSlotsWithoutCover(plan: SquadPlan | null, slotCount: number): number {
  if (!plan) return slotCount;
  return slotCount - plan.slots.filter((slot) => slot.players.length >= 2).length;
}

export function parseHorizon(horizon: string | null): Date | null {
  if (!horizon || horizon.split('/').length !== 3) return null;
  const date = parseCustomDate(horizon);
  return Number.isNaN(date.getTime()) ? null : date;
}
