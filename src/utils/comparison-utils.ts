import type { Player, LeagueRanking } from "../types/types";
import type { RoleConfig } from "../roles";
import { STAT_LABELS, INVERTED_STATS } from "../roles";
import { getPercentile, getColumn } from "./utils";

export interface StatPercentile {
  statKey: string;
  label: string;
  value: number;
  percentile: number;
}

export function buildCohort(
  allPlayers: Player[],
  RoleClass: RoleConfig["RoleClass"],
  leagueRankings: LeagueRanking[]
): Record<string, unknown>[] {
  const rankedLeagues = new Set(
    leagueRankings.filter((r) => r.rank < 999).map((r) => r.league)
  );

  return allPlayers
    .filter(
      (p) =>
        RoleClass.isRole(p) &&
        rankedLeagues.has(p.Division) &&
        p.Mins >= 900,
    )
    .map((p) => new RoleClass(p) as unknown as Record<string, unknown>);
}

export function computePercentiles(
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

export function isInverted(statKey: string): boolean {
  return INVERTED_STATS.has(statKey);
}
