import { LeftFullback, RightFullback, LeftWinger, RightWinger, type RoleConfig } from "../roles";
import type { Side } from "../types/briefs";

export const STAT_ABBREVIATIONS: Record<string, string> = {
  saveRatio: "SR",
  expectedSaveRatio: "xSR",
  saveRatioOverExpected: "SR+",
  goalsPrevented: "GP",
  savesHeldRatio: "SH",
  concededPer90: "Con",
  savesPer90: "Sv",
  shotStoppingRank: "SSR",
  passRatio: "PR",
  progressivePasses: "PP",
  keyPasses: "KP",
  tackles: "Tkl",
  tackleRatio: "TR",
  pressureRatio: "Pr%",
  pressuresAttempted: "PrA",
  defensiveContributions: "DC",
  headersWonRatio: "HW",
  aerialAttempts: "AA",
  keyHeaders: "KH",
  crossRatio: "CR",
  crossesSuccessful: "Crs",
  xA: "xA",
  chancesCreated: "CC",
  dribbles: "Drb",
  sprints: "Spr",
  npxG: "xG",
  conversionRatio: "Cv",
  goals: "Gls",
  xGOverperformance: "xG+",
  shots: "Sh",
  possessionWon: "PW",
  possessionLost: "PL",
  mistakes: "Mst",
  distance: "Dst",
};

export const GROUP_ABBREVIATIONS: Record<string, string> = {
  goalkeeper: "GK",
  passing: "Pas",
  error: "Err",
  defensive: "Def",
  aerial: "Aer",
  creative: "Cre",
  movement: "Mov",
  crossing: "Cro",
  attacking: "Att",
};

export function roleClassFor(config: RoleConfig, side: Side): RoleConfig["RoleClass"] {
  if (side === "both") return config.RoleClass;
  if (config.key === "FB") return side === "left" ? LeftFullback : RightFullback;
  if (config.key === "W") return side === "left" ? LeftWinger : RightWinger;
  return config.RoleClass;
}
