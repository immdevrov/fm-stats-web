import { ROLE_CONFIG } from "../roles";
import type { Brief } from "../types/briefs";
import type { PlayerList } from "../types/annotations";
import type { LeagueRanking, Player } from "../types/types";
import { roleNoun } from "./briefs";
import { cohortExclusions, rankedLeagueSet, type CohortExclusion } from "./scouting-engine";
import { roleClassFor } from "./scouting-columns";

const NO_STATS = "no stats";

function reasonText(reason: CohortExclusion, player: Player, brief: Brief): string {
  if (reason === "minutes") return player.Mins === 0 ? NO_STATS : `${player.Mins} minutes`;
  if (reason === "league") return "unranked league";
  return `not ${roleNoun(brief.filters.roleKey, brief.filters.side)}`;
}

export function briefCohortWarning(
  player: Player,
  list: PlayerList,
  briefs: Brief[],
  rankings: LeagueRanking[]
): { title: string; description: string } | null {
  const rankedLeagues = rankedLeagueSet(rankings);
  if (rankedLeagues.size === 0) return null;

  const findings: { name: string; reasons: string[] }[] = [];
  for (const brief of briefs) {
    if (brief.listId !== list.id) continue;
    const config = ROLE_CONFIG.find((rc) => rc.key === brief.filters.roleKey);
    if (!config) continue;
    const exclusions = cohortExclusions(
      player,
      roleClassFor(config, brief.filters.side),
      rankedLeagues
    );
    if (exclusions.length === 0) continue;
    findings.push({
      name: brief.name,
      reasons: exclusions.map((reason) => reasonText(reason, player, brief)),
    });
  }
  if (findings.length === 0) return null;

  const detail = findings.map((f) => `${f.name}: ${f.reasons.join(", ")}`).join("; ");
  return {
    title: "Outside a brief's cohort",
    description: `Added to ${list.name}. ${detail}.${
      player.Mins === 0 ? "" : " Ranked against the cohort — a rough guide."
    }`,
  };
}
