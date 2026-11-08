import { getDB, wrapError } from './connection';
import type { PlannedSlot, SquadPlan } from '../../types/planner';
import { getPreset } from '../../formations';
import { GK_CELL, cellKey, isPlayableCell } from '../../formations/grid';
import {
  FILTERS_STATS_VERSION,
  brokenByStatChange,
  coerceFilters,
} from '../../utils/scouting-filters';
import type { Brief, BriefPick } from '../../types/briefs';

const MY_CLUB = 'myClub';
const SQUAD_PLAN = 'squadPlan';
const ACTIVE_SNAPSHOT = 'activeSnapshot';
const BRIEFS = 'archetypes';

async function _get(key: string): Promise<unknown> {
  try {
    const db = await getDB();
    const entry = await db.get('settings', key);
    return entry?.value ?? null;
  } catch (error) {
    throw wrapError(`read ${key}`, error);
  }
}

async function _set(key: string, value: unknown, action: string): Promise<void> {
  try {
    const db = await getDB();
    if (value === null) {
      await db.delete('settings', key);
      return;
    }
    await db.put('settings', { key, value });
  } catch (error) {
    throw wrapError(action, error);
  }
}

export async function getMyClub(): Promise<string | null> {
  const value = await _get(MY_CLUB);
  return typeof value === 'string' ? value : null;
}

export function setMyClub(club: string | null): Promise<void> {
  return _set(MY_CLUB, club, 'save my team');
}

function isPlannedSlot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const slot = value as Partial<PlannedSlot>;
  return (
    typeof slot.slotId === 'string' &&
    typeof slot.cell === 'object' &&
    slot.cell !== null &&
    typeof slot.cell.row === 'string' &&
    typeof slot.cell.col === 'number' &&
    Array.isArray(slot.players)
  );
}

function isSquadPlan(value: unknown): value is SquadPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Partial<SquadPlan>;
  if (!Array.isArray(plan.slots) || !plan.slots.every(isPlannedSlot)) return false;
  const keys = new Set(plan.slots.map((slot) => cellKey(slot.cell)));
  return (
    keys.size === plan.slots.length &&
    plan.slots.every((slot) => cellKey(slot.cell) === cellKey(GK_CELL) || isPlayableCell(slot.cell))
  );
}

function fromLegacy(value: { formationId: string; slots: unknown[]; horizon?: unknown }): SquadPlan | null {
  const preset = getPreset(value.formationId);
  if (!preset) return null;
  const stored = new Map(
    value.slots
      .filter(
        (slot): slot is Partial<PlannedSlot> =>
          typeof slot === 'object' &&
          slot !== null &&
          typeof (slot as Partial<PlannedSlot>).slotId === 'string' &&
          Array.isArray((slot as Partial<PlannedSlot>).players)
      )
      .map((slot) => [slot.slotId, slot.players])
  );
  return {
    horizon: value.horizon as SquadPlan['horizon'],
    slots: preset.slots.map((slot) => ({
      slotId: slot.id,
      cell: slot.cell,
      players: stored.get(slot.id) ?? [],
    })),
  };
}

const HORIZON_PRESETS = new Set(['now', 'season', '1y', '2y']);

export async function getSquadPlan(): Promise<SquadPlan | null> {
  const value = await _get(SQUAD_PLAN);
  const isLegacy =
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { formationId?: unknown }).formationId === 'string' &&
    Array.isArray((value as { slots?: unknown }).slots);
  const plan = isLegacy
    ? fromLegacy(value as { formationId: string; slots: unknown[]; horizon?: unknown })
    : isSquadPlan(value)
      ? value
      : null;
  if (!plan) return null;
  return HORIZON_PRESETS.has(plan.horizon as string) ? plan : { ...plan, horizon: null };
}

export function setSquadPlan(plan: SquadPlan | null): Promise<void> {
  return _set(SQUAD_PLAN, plan, 'save squad plan');
}

export async function _getStoredActiveSnapshot(): Promise<string | null> {
  const value = await _get(ACTIVE_SNAPSHOT);
  return typeof value === 'string' ? value : null;
}

export function setActiveSnapshotId(id: string | null): Promise<void> {
  return _set(ACTIVE_SNAPSHOT, id, 'save active snapshot');
}

export async function getBriefs(): Promise<{ briefs: Brief[]; removed: string[] }> {
  const value = await _get(BRIEFS);
  if (!Array.isArray(value)) return { briefs: [], removed: [] };
  const seen = new Set<string>();
  const result: Brief[] = [];
  const removed: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, name, filters, listId } = entry as Partial<Brief>;
    if (typeof id !== 'string' || !id || typeof name !== 'string' || !name || seen.has(id)) continue;
    seen.add(id);
    const brief: Brief = { id, name, filters: coerceFilters(filters) };
    const { statsVersion } = entry as { statsVersion?: unknown };
    if (brokenByStatChange(brief.filters, statsVersion)) {
      removed.push(name);
      continue;
    }
    if (typeof listId === 'string' && listId) brief.listId = listId;
    const picks = _coercePicks((entry as { picks?: unknown }).picks);
    if (picks) brief.picks = picks;
    result.push(brief);
  }
  return { briefs: result, removed };
}

function _coercePicks(value: unknown): BriefPick[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<number>();
  const picks: BriefPick[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { uid, grade, verdict } = raw as Record<string, unknown>;
    if (typeof uid !== 'number' || !Number.isFinite(uid) || seen.has(uid)) continue;
    seen.add(uid);
    const pick: BriefPick = { uid };
    if (grade === 'A' || grade === 'B' || grade === 'C') pick.grade = grade;
    if (typeof verdict === 'string' && verdict.trim()) pick.verdict = verdict.trim();
    picks.push(pick);
  }
  return picks.length ? picks : undefined;
}

export function setBriefs(briefs: Brief[]): Promise<void> {
  const stamped = briefs.map((brief) => ({ ...brief, statsVersion: FILTERS_STATS_VERSION }));
  return _set(BRIEFS, stamped, 'save briefs');
}
