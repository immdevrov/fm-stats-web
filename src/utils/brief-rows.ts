import { ROLE_CONFIG, INVERTED_STATS, STAT_LABELS, type RoleConfig } from "../roles";
import type { Player, LeagueRanking } from "../types/types";
import type { PlayerAnnotation, PlayerList } from "../types/annotations";
import type { Brief, ContractHorizon, Grade } from "../types/briefs";
import { STAT_ABBREVIATIONS, GROUP_ABBREVIATIONS, roleClassFor } from "./scouting-columns";
import { getStatGroupsForRole, type StatGroup } from "./stat-group-mapping";
import {
  asRole,
  buildCohortRanking,
  buildScoutingCohort,
  cohortExclusions,
  rankPlayer,
  rankedLeagueSet,
  type ScoutingRow,
} from "./scouting-engine";
import { formatWage } from "./utils";
import { roleLabel, roleNoun } from "./briefs";
import { orderedShortlist } from "./brief-picks";

export interface HeatKey {
  key: string;
  abbr: string;
  label: string;
  group?: StatGroup;
}

export interface BriefRow extends Record<string, unknown> {
  index: number;
  uid: number;
  grade: Grade | null;
  verdict: string | null;
  name: string;
  absent: boolean;
  tags: string[];
  identity?: Pick<Player, "Name" | "Club">;
  age: number | null;
  club: string | null;
  division: string | null;
  wage: number | null;
  contractExpires: Date | null;
  mins: number | null;
}

const CONTRACT_CRITERIA: Record<ContractHorizon, string> = {
  season: "contract by end of season",
  "1y": "contract within a year",
  "2y": "contract within two years",
};

export function briefRoleConfig(brief: Brief): RoleConfig {
  return ROLE_CONFIG.find((rc) => rc.key === brief.filters.roleKey) ?? ROLE_CONFIG[0];
}

export function heatKeys(roleConfig: RoleConfig): HeatKey[] {
  const keys: HeatKey[] = roleConfig.statKeys.map((k) => ({
    key: `stat_${k}`,
    abbr: STAT_ABBREVIATIONS[k] ?? k,
    label: STAT_LABELS[k] ?? k,
  }));
  for (const derived of roleConfig.derivedPercentileStats ?? []) {
    keys.push({
      key: `derived_${derived.key}`,
      abbr: STAT_ABBREVIATIONS[derived.key] ?? derived.key,
      label: STAT_LABELS[derived.key] ?? derived.key,
    });
  }
  for (const group of getStatGroupsForRole(roleConfig.key)) {
    keys.push({
      key: `group_${group.key}`,
      abbr: GROUP_ABBREVIATIONS[group.key] ?? group.key,
      label: group.label,
      group,
    });
  }
  return keys;
}

function boundOf(value: string | undefined): string | null {
  return value && !isNaN(Number(value)) ? value : null;
}

export function thresholdText(
  bounds: { min?: string; max?: string } | undefined,
  format: (value: string) => string = (value) => value
): string | null {
  const min = boundOf(bounds?.min);
  const max = boundOf(bounds?.max);
  if (min && max) return `${format(min)}–${format(max)}`;
  if (min) return `≥ ${format(min)}`;
  if (max) return `≤ ${format(max)}`;
  return null;
}

export function briefCriteria(brief: Brief): string[] {
  const f = brief.filters;
  const parts = [roleLabel(f.roleKey, f.side)];
  const columns: { key: string; abbr: string; format?: (value: string) => string }[] = [
    { key: "age", abbr: "Age" },
    { key: "wage", abbr: "Wage", format: (value) => formatWage(Number(value)) },
    ...heatKeys(briefRoleConfig(brief)),
  ];
  for (const column of columns) {
    const threshold = thresholdText(f.columnFilters[column.key], column.format);
    if (threshold) parts.push(`${column.abbr} ${threshold}`);
  }
  if (f.contractHorizon) parts.push(CONTRACT_CRITERIA[f.contractHorizon]);
  if (f.excludeInjuries) parts.push("injury-free");
  const excluded = f.excludedLeagues.length;
  if (excluded > 0) parts.push(`${excluded} league${excluded === 1 ? "" : "s"} excluded`);
  return parts;
}

function heatValue(row: ScoutingRow | null, key: string): number | null {
  if (!row) return null;
  if (key.startsWith("stat_")) {
    const statKey = key.slice(5);
    const p = row.statPercentiles[statKey];
    if (p === undefined) return null;
    return INVERTED_STATS.has(statKey) ? 100 - p : p;
  }
  if (key.startsWith("derived_")) return row.statPercentiles[key.slice(8)] ?? null;
  if (key.startsWith("group_")) return row.groupRatings[key.slice(6)] ?? null;
  return null;
}

export function buildBriefRows(
  brief: Brief,
  list: PlayerList,
  roster: Player[],
  rankings: LeagueRanking[],
  annotations: Map<number, PlayerAnnotation>
): BriefRow[] {
  const { roleKey, side } = brief.filters;
  const roleConfig = briefRoleConfig(brief);
  const RoleClass = roleClassFor(roleConfig, side);
  const keys = heatKeys(roleConfig);
  const rankedLeagues = rankedLeagueSet(rankings);
  const ranking = buildCohortRanking(
    buildScoutingCohort(roster, RoleClass, rankings),
    roleConfig,
    getStatGroupsForRole(roleConfig.key)
  );
  const byUid = new Map(roster.map((player) => [player.UID, player]));

  return orderedShortlist(brief.picks, list.uids).map(({ uid, grade, verdict }, i) => {
    const player = byUid.get(uid);
    if (!player) {
      const annotation = annotations.get(uid);
      const row: BriefRow = {
        index: i + 1,
        uid,
        grade: grade ?? null,
        verdict: verdict ?? null,
        name: annotation?.lastKnownName ?? `UID ${uid}`,
        absent: true,
        tags: ["Not in this snapshot"],
        identity: annotation?.lastKnownName
          ? { Name: annotation.lastKnownName, Club: annotation.lastKnownClub ?? "" }
          : undefined,
        age: null,
        club: annotation?.lastKnownClub ?? null,
        division: null,
        wage: null,
        contractExpires: null,
        mins: null,
      };
      for (const { key } of keys) row[key] = null;
      return row;
    }

    const noStats = player.Mins === 0;
    const tags = cohortExclusions(player, RoleClass, rankedLeagues).map((reason) => {
      if (reason === "role") return `Not ${roleNoun(roleKey, side)}`;
      if (reason === "league") return "Unranked league";
      return noStats ? "No stats" : `${player.Mins} min`;
    });
    const scored = ranking && !noStats ? rankPlayer(asRole(player, RoleClass), ranking) : null;
    const row: BriefRow = {
      index: i + 1,
      uid,
      grade: grade ?? null,
      verdict: verdict ?? null,
      name: player.Name,
      absent: false,
      tags,
      identity: { Name: player.Name, Club: player.Club },
      age: player.Age,
      club: player.Club,
      division: player.Division,
      wage: player.Wage,
      contractExpires: player.Expires,
      mins: player.Mins,
    };
    for (const { key } of keys) row[key] = heatValue(scored, key);
    return row;
  });
}
