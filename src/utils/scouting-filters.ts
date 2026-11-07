import { ROLE_CONFIG } from "../roles";
import type { ColumnFilters, ContractHorizon, ScoutingFilters, Side } from "../types/archetypes";

const STORAGE_KEY = "scouting-filters";
const SIDES: readonly Side[] = ["both", "left", "right"];
const CONTRACT_HORIZONS: readonly ContractHorizon[] = ["season", "1y", "2y"];

export const DEFAULT_FILTERS: ScoutingFilters = {
  roleKey: ROLE_CONFIG[0].key,
  side: "both",
  columnFilters: {},
  contractHorizon: null,
  excludeInjuries: true,
  excludedLeagues: [],
  sortKey: "name",
  sortDirection: "asc",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceColumnFilters(value: unknown): ColumnFilters {
  if (!isRecord(value)) return {};
  const result: ColumnFilters = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    const min = typeof entry.min === "string" && entry.min !== "" ? entry.min : undefined;
    const max = typeof entry.max === "string" && entry.max !== "" ? entry.max : undefined;
    if (min === undefined && max === undefined) continue;
    result[key] = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
  }
  return result;
}

function coerceRoleKey(value: Record<string, unknown>): string {
  if (typeof value.roleKey === "string" && ROLE_CONFIG.some((rc) => rc.key === value.roleKey)) {
    return value.roleKey;
  }
  if (typeof value.selectedRoleIndex === "number") {
    return ROLE_CONFIG[value.selectedRoleIndex]?.key ?? DEFAULT_FILTERS.roleKey;
  }
  return DEFAULT_FILTERS.roleKey;
}

export function coerceFilters(value: unknown): ScoutingFilters {
  if (!isRecord(value)) return { ...DEFAULT_FILTERS };
  return {
    roleKey: coerceRoleKey(value),
    side: SIDES.includes(value.side as Side) ? (value.side as Side) : DEFAULT_FILTERS.side,
    columnFilters: coerceColumnFilters(value.columnFilters),
    contractHorizon: CONTRACT_HORIZONS.includes(value.contractHorizon as ContractHorizon)
      ? (value.contractHorizon as ContractHorizon)
      : null,
    excludeInjuries:
      typeof value.excludeInjuries === "boolean" ? value.excludeInjuries : DEFAULT_FILTERS.excludeInjuries,
    excludedLeagues: Array.isArray(value.excludedLeagues)
      ? value.excludedLeagues.filter((league): league is string => typeof league === "string")
      : [],
    sortKey: typeof value.sortKey === "string" ? value.sortKey : DEFAULT_FILTERS.sortKey,
    sortDirection: value.sortDirection === "desc" ? "desc" : "asc",
  };
}

function sameColumnFilters(a: ColumnFilters, b: ColumnFilters): boolean {
  const left = coerceColumnFilters(a);
  const right = coerceColumnFilters(b);
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => left[key].min === right[key]?.min && left[key].max === right[key]?.max);
}

export function sameFilters(a: ScoutingFilters, b: ScoutingFilters): boolean {
  const leaguesA = new Set(a.excludedLeagues);
  const leaguesB = new Set(b.excludedLeagues);
  return (
    a.roleKey === b.roleKey &&
    a.side === b.side &&
    a.contractHorizon === b.contractHorizon &&
    a.excludeInjuries === b.excludeInjuries &&
    a.sortKey === b.sortKey &&
    a.sortDirection === b.sortDirection &&
    leaguesA.size === leaguesB.size &&
    [...leaguesA].every((league) => leaguesB.has(league)) &&
    sameColumnFilters(a.columnFilters, b.columnFilters)
  );
}

export interface WorkingState {
  filters: ScoutingFilters;
  activeArchetypeId: string | null;
}

export function loadWorkingState(): WorkingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const activeArchetypeId =
      isRecord(parsed) && typeof parsed.activeArchetypeId === "string" ? parsed.activeArchetypeId : null;
    return { filters: coerceFilters(parsed), activeArchetypeId };
  } catch {
    return { filters: { ...DEFAULT_FILTERS }, activeArchetypeId: null };
  }
}

export function saveWorkingState({ filters, activeArchetypeId }: WorkingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, activeArchetypeId }));
  } catch {
    /* ignore */
  }
}
