import type { FormationSlot } from '../formations';
import { isPlayableCell, sameCell, type Cell } from '../formations/grid';
import type { PlayerPosition, PlayerPositions } from '../fields/positions';
import { MAX_DEPTH, type HorizonPreset, type PlannedPlayer, type SquadPlan } from '../types/planner';
import { formatPositions, getEffectivePosition } from './utils';

export type PositionedPlayer = { Position: PlayerPositions; CustomPosition?: PlayerPositions };

export interface Placement {
  slotId: string;
  rank: number;
}

export type PlacementIndex = Map<number, Placement[]>;

export function byAgeDesc(a: { Age: number; Name: string }, b: { Age: number; Name: string }): number {
  return b.Age - a.Age || a.Name.localeCompare(b.Name);
}

function sideMatches(slotSide: PlayerPosition['side'], playerSide: PlayerPosition['side']): boolean {
  if (!slotSide?.length || !playerSide?.length) return true;
  return slotSide.some((side) => playerSide.includes(side));
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

export function resolveHorizon(
  snapshotDate: string | null,
  preset: HorizonPreset | null
): Date | null {
  if (!snapshotDate || !preset) return null;
  const [year, month, day] = snapshotDate.split('-').map(Number);
  if (preset === 'now') return new Date(year, month - 1, day);
  if (preset === '1y') return new Date(year + 1, month - 1, day);
  if (preset === '2y') return new Date(year + 2, month - 1, day);
  return new Date(month > 6 ? year + 1 : year, 5, 30);
}

export function moveMarker(plan: SquadPlan, slotId: string, cell: Cell): SquadPlan {
  const moving = plan.slots.find((slot) => slot.slotId === slotId);
  if (!moving || moving.cell.row === 'GK') return plan;
  if (cell.row === 'GK' || !isPlayableCell(cell) || sameCell(moving.cell, cell)) return plan;

  const origin = moving.cell;
  return {
    ...plan,
    slots: plan.slots.map((slot) => {
      if (slot.slotId === slotId) return { ...slot, cell };
      if (sameCell(slot.cell, cell)) return { ...slot, cell: origin };
      return slot;
    }),
  };
}

export function moveCard(
  plan: SquadPlan,
  from: { slotId: string; uid: number },
  to: { slotId: string; index: number | null }
): SquadPlan {
  const source = plan.slots.find((slot) => slot.slotId === from.slotId);
  const target = plan.slots.find((slot) => slot.slotId === to.slotId);
  const fromIndex = source?.players.findIndex((p) => p.uid === from.uid) ?? -1;
  if (!source || !target || fromIndex < 0) return plan;
  const moved = source.players[fromIndex];

  let nextSource: PlannedPlayer[];
  let nextTarget: PlannedPlayer[];

  if (source === target) {
    const without = source.players.filter((_, i) => i !== fromIndex);
    const at = to.index === null ? without.length : Math.min(to.index, without.length);
    nextSource = [...without.slice(0, at), moved, ...without.slice(at)];
    if (nextSource.every((p, i) => p === source.players[i])) return plan;
    nextTarget = nextSource;
  } else if (target.players.some((p) => p.uid === from.uid)) {
    return plan;
  } else if (target.players.length < MAX_DEPTH) {
    const at = to.index ?? target.players.length;
    nextSource = source.players.filter((_, i) => i !== fromIndex);
    nextTarget = [...target.players.slice(0, at), moved, ...target.players.slice(at)];
  } else {
    if (to.index === null) return plan;
    const displaced = target.players[to.index];
    if (!displaced || source.players.some((p) => p.uid === displaced.uid)) return plan;
    nextSource = source.players.map((p, i) => (i === fromIndex ? displaced : p));
    nextTarget = target.players.map((p, i) => (i === to.index ? moved : p));
  }

  return {
    ...plan,
    slots: plan.slots.map((slot) => {
      if (slot === source) return { ...slot, players: nextSource };
      if (slot === target) return { ...slot, players: nextTarget };
      return slot;
    }),
  };
}
