import type { Player, LeagueRanking } from "../types/types";
import type { RoleConfig } from "../roles";
import { INVERTED_STATS, Role } from "../roles";
import { getPercentile, getColumn } from "./utils";
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

export function buildScoutingCohort(
  allPlayers: Player[],
  RoleClass: RoleConfig["RoleClass"],
  leagueRankings: LeagueRanking[]
): Role[] {
  const rankedLeagues = new Set(
    leagueRankings.filter((r) => r.rank < 999).map((r) => r.league)
  );

  return allPlayers
    .filter(
      (p) =>
        RoleClass.isRole(p) &&
        rankedLeagues.has(p.Division) &&
        p.Starts >= 5
    )
    .map((p) => new RoleClass(p));
}

export function computeScoutingData(
  cohort: Role[],
  roleConfig: RoleConfig,
  statGroups: StatGroup[]
): ScoutingRow[] {
  if (cohort.length === 0) return [];

  const cohortRecords = cohort as unknown as Record<string, unknown>[];
  const { statKeys } = roleConfig;

  // Pre-compute sorted columns for all stats (statKeys + all group stats)
  const allStatKeys = new Set(statKeys);
  for (const group of statGroups) {
    for (const key of group.statKeys) {
      allStatKeys.add(key);
    }
  }

  const sortedColumns: Record<string, number[]> = {};
  for (const key of allStatKeys) {
    sortedColumns[key] = (getColumn(cohortRecords, key) as number[])
      .slice()
      .sort((a, b) => a - b);
  }

  // Compute per-player percentiles for ALL stats
  const allPercentiles: Record<string, number>[] = cohort.map((player) => {
    const record = player as unknown as Record<string, number>;
    const percentiles: Record<string, number> = {};
    for (const key of allStatKeys) {
      percentiles[key] = getPercentile(record[key], sortedColumns[key]);
    }
    return percentiles;
  });

  // Compute group scores per player
  const groupScores: Record<string, number[]> = {};
  for (const group of statGroups) {
    groupScores[group.key] = [];
  }

  const playerGroupScores: Record<string, number>[] = cohort.map((_, i) => {
    const scores: Record<string, number> = {};
    for (const group of statGroups) {
      let sum = 0;
      for (const key of group.statKeys) {
        const p = allPercentiles[i][key];
        sum += INVERTED_STATS.has(key) ? 100 - p : p;
      }
      scores[group.key] = sum;
      groupScores[group.key].push(sum);
    }
    return scores;
  });

  // Sort group score columns for percentile ranking
  const sortedGroupScores: Record<string, number[]> = {};
  for (const group of statGroups) {
    sortedGroupScores[group.key] = groupScores[group.key]
      .slice()
      .sort((a, b) => a - b);
  }

  // Build final rows
  return cohort.map((player, i) => {
    const statPercentiles: Record<string, number> = {};
    for (const key of statKeys) {
      statPercentiles[key] = allPercentiles[i][key];
    }

    const groupRatings: Record<string, number> = {};
    for (const group of statGroups) {
      groupRatings[group.key] = getPercentile(
        playerGroupScores[i][group.key],
        sortedGroupScores[group.key]
      );
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
  });
}
