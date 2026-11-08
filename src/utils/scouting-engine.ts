import type { Player, LeagueRanking } from "../types/types";
import type { RoleConfig } from "../roles";
import { INVERTED_STATS, Role } from "../roles";
import { getPercentileFromSorted, getColumn } from "./utils";
import { type StatGroup } from "./stat-group-mapping";

export interface ScoutingRow extends Record<string, unknown> {
  uid: number;
  name: string;
  age: number;
  club: string;
  division: string;
  wage: number;
  contractExpires: Date | null;
  injuries: boolean;
  statPercentiles: Record<string, number>;
  groupRatings: Record<string, number>;
}

export type CohortExclusion = "minutes" | "league" | "role";

export function cohortExclusions(
  player: Player,
  RoleClass: RoleConfig["RoleClass"],
  rankedLeagues: Set<string>
): CohortExclusion[] {
  const reasons: CohortExclusion[] = [];
  if (!RoleClass.isRole(player)) reasons.push("role");
  if (!rankedLeagues.has(player.Division)) reasons.push("league");
  if (!(player.Mins >= 900)) reasons.push("minutes");
  return reasons;
}

export function rankedLeagueSet(rankings: LeagueRanking[]): Set<string> {
  return new Set(rankings.filter((r) => r.rank < 999).map((r) => r.league));
}

const roleClassOverrides = new Map<RoleConfig["RoleClass"], RoleConfig["RoleClass"]>();

export function asRole(player: Player, RoleClass: RoleConfig["RoleClass"]): Role {
  let Wrapped = roleClassOverrides.get(RoleClass);
  if (!Wrapped) {
    Wrapped = class extends RoleClass {
      static isRole() {
        return true;
      }
    };
    roleClassOverrides.set(RoleClass, Wrapped);
  }
  return new Wrapped(player);
}

export function buildScoutingCohort(
  allPlayers: Player[],
  RoleClass: RoleConfig["RoleClass"],
  leagueRankings: LeagueRanking[]
): Role[] {
  const rankedLeagues = rankedLeagueSet(leagueRankings);
  return allPlayers
    .filter((p) => cohortExclusions(p, RoleClass, rankedLeagues).length === 0)
    .map((p) => new RoleClass(p));
}

export interface CohortRanking {
  roleConfig: RoleConfig;
  statGroups: StatGroup[];
  sortedColumns: Record<string, number[]>;
  sortedGroupSums: Record<string, number[]>;
}

function allStatKeysOf(roleConfig: RoleConfig, statGroups: StatGroup[]): Set<string> {
  const keys = new Set<string>(roleConfig.statKeys);
  for (const group of statGroups) {
    for (const key of group.statKeys) keys.add(key);
  }
  return keys;
}

function percentilesOf(
  player: Role,
  keys: Iterable<string>,
  sortedColumns: Record<string, number[]>
): Record<string, number> {
  const record = player as unknown as Record<string, number>;
  const percentiles: Record<string, number> = {};
  for (const key of keys) {
    percentiles[key] = getPercentileFromSorted(record[key], sortedColumns[key]);
  }
  return percentiles;
}

function groupSumOf(group: StatGroup, percentiles: Record<string, number>): number {
  let sum = 0;
  for (const key of group.statKeys) {
    const p = percentiles[key];
    sum += INVERTED_STATS.has(key) ? 100 - p : p;
  }
  return sum;
}

export function buildCohortRanking(
  cohort: Role[],
  roleConfig: RoleConfig,
  statGroups: StatGroup[]
): CohortRanking | null {
  if (cohort.length === 0) return null;

  const cohortRecords = cohort as unknown as Record<string, unknown>[];
  const keys = allStatKeysOf(roleConfig, statGroups);

  const sortedColumns: Record<string, number[]> = {};
  for (const key of keys) {
    sortedColumns[key] = (getColumn(cohortRecords, key) as number[])
      .slice()
      .sort((a, b) => a - b);
  }

  const sortedGroupSums: Record<string, number[]> = {};
  for (const group of statGroups) sortedGroupSums[group.key] = [];
  for (const player of cohort) {
    const percentiles = percentilesOf(player, keys, sortedColumns);
    for (const group of statGroups) {
      sortedGroupSums[group.key].push(groupSumOf(group, percentiles));
    }
  }
  for (const group of statGroups) {
    sortedGroupSums[group.key].sort((a, b) => a - b);
  }

  return { roleConfig, statGroups, sortedColumns, sortedGroupSums };
}

export function rankPlayer(player: Role, ranking: CohortRanking): ScoutingRow {
  const { roleConfig, statGroups, sortedColumns, sortedGroupSums } = ranking;
  const percentiles = percentilesOf(
    player,
    allStatKeysOf(roleConfig, statGroups),
    sortedColumns
  );

  const groupRatings: Record<string, number> = {};
  for (const group of statGroups) {
    groupRatings[group.key] = getPercentileFromSorted(
      groupSumOf(group, percentiles),
      sortedGroupSums[group.key]
    );
  }

  const { derivedPercentileStats } = roleConfig;
  if (derivedPercentileStats) {
    for (const derived of derivedPercentileStats) {
      percentiles[derived.key] = derived.formula(percentiles);
    }
  }

  const statPercentiles: Record<string, number> = {};
  for (const key of roleConfig.statKeys) statPercentiles[key] = percentiles[key];
  if (derivedPercentileStats) {
    for (const derived of derivedPercentileStats) {
      statPercentiles[derived.key] = percentiles[derived.key];
    }
  }

  return {
    uid: player.uid,
    name: player.name,
    age: player.age,
    club: player.club,
    division: player.division,
    wage: player.wage,
    contractExpires: player.contractExpires,
    injuries: player.injuries,
    statPercentiles,
    groupRatings,
  };
}

export function computeScoutingData(
  cohort: Role[],
  roleConfig: RoleConfig,
  statGroups: StatGroup[]
): ScoutingRow[] {
  const ranking = buildCohortRanking(cohort, roleConfig, statGroups);
  if (!ranking) return [];
  return cohort.map((p) => rankPlayer(p, ranking));
}
