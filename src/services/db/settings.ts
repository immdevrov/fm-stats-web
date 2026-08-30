import { getDB, wrapError } from './connection';
import type { SquadPlan } from '../../types/planner';

const MY_CLUB = 'myClub';
const SQUAD_PLAN = 'squadPlan';

async function _get(key: string): Promise<unknown> {
  try {
    const db = await getDB();
    const entry = await db.get('settings', key);
    return entry?.value ?? null;
  } catch {
    return null;
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

function isSquadPlan(value: unknown): value is SquadPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Partial<SquadPlan>;
  return typeof plan.formationId === 'string' && Array.isArray(plan.slots);
}

export async function getSquadPlan(): Promise<SquadPlan | null> {
  const value = await _get(SQUAD_PLAN);
  return isSquadPlan(value) ? value : null;
}

export function setSquadPlan(plan: SquadPlan | null): Promise<void> {
  return _set(SQUAD_PLAN, plan, 'save squad plan');
}
