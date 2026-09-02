import type { Player, LeagueRanking } from "../types/types";
import type { RoleConfig } from "../roles";
import { STAT_LABELS } from "../roles";
import { getColumn, getPercentile } from "./utils";

export interface StatPercentile {
  statKey: string;
  label: string;
  value: number;
  percentile: number;
}

export function getComparisonCohort(
  RoleClass: RoleConfig["RoleClass"],
  allPlayers: Player[],
  leagueRankings: LeagueRanking[],
  sameLeagueOnly?: string
): Record<string, unknown>[] {
  const rankedLeagues = new Set(
    leagueRankings.filter((r) => r.rank < 999).map((r) => r.league)
  );

  return allPlayers
    .filter(
      (p) =>
        RoleClass.isRole(p) &&
        rankedLeagues.has(p.Division) &&
        p.Mins >= 900 &&
        (!sameLeagueOnly || p.Division === sameLeagueOnly)
    )
    .map((p) => new RoleClass(p) as unknown as Record<string, unknown>);
}

export function calculateRolePercentiles(
  playerRole: Record<string, unknown>,
  cohort: Record<string, unknown>[],
  statKeys: string[]
): StatPercentile[] {
  return statKeys.map((key) => {
    const playerValue = playerRole[key] as number;
    const cohortValues = getColumn(cohort, key) as number[];

    return {
      statKey: key,
      label: STAT_LABELS[key] ?? key,
      value: playerValue,
      percentile: getPercentile(playerValue, cohortValues),
    };
  });
}
