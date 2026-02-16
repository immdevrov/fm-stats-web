import type { Player } from "../types";
import { GoalKeeper } from "./goalkeeper";
import { CentralDefender } from "./central-defender";
import { Fullback } from "./fullback";
import { DefensiveMidfielder } from "./defensive-midfielder";
import { CentralMidfielder } from "./central-midfielder";
import { AttackingMidfielder } from "./attacking-midfielder";
import { Winger } from "./winger";
import { Striker } from "./striker";
import { Role } from "./_role";

export { Role };
export { GoalKeeper } from "./goalkeeper";
export { CentralDefender } from "./central-defender";
export { Fullback, LeftFullback, RightFullback } from "./fullback";
export { DefensiveMidfielder } from "./defensive-midfielder";
export { CentralMidfielder } from "./central-midfielder";
export { AttackingMidfielder } from "./attacking-midfielder";
export { Winger, LeftWinger, RightWinger } from "./winger";
export { Striker } from "./striker";

type RoleConstructor = {
  new (player: Player): Role;
  isRole(player: Player): boolean;
};

export interface RoleConfig {
  key: string;
  name: string;
  RoleClass: RoleConstructor;
  statKeys: string[];
}

export const ROLE_CONFIG: RoleConfig[] = [
  {
    key: "GK",
    name: "Goalkeeper",
    RoleClass: GoalKeeper,
    statKeys: [
      "saveRatio",
      "expectedSaveRatio",
      "saveRatioOverExpected",
      "goalsPrevented",
      "savesHeldRatio",
      "concededPer90",
      "savesPer90",
      "passRatio",
      "progressivePasses",
      "mistakes",
    ],
  },
  {
    key: "CD",
    name: "Central Defender",
    RoleClass: CentralDefender,
    statKeys: [
      "tackles",
      "tackleRatio",
      "pressuresSuccessful",
      "headersWonRatio",
      "aerialAttempts",
      "keyHeaders",
      "passRatio",
      "progressivePasses",
      "mistakes",
    ],
  },
  {
    key: "FB",
    name: "Fullback",
    RoleClass: Fullback,
    statKeys: [
      "tackles",
      "tackleRatio",
      "pressuresSuccessful",
      "headersWonRatio",
      "crossRatio",
      "crossesSuccessful",
      "xA",
      "dribbles",
      "progressivePasses",
      "mistakes",
    ],
  },
  {
    key: "DM",
    name: "Defensive Mid",
    RoleClass: DefensiveMidfielder,
    statKeys: [
      "tackles",
      "tackleRatio",
      "pressuresSuccessful",
      "headersWonRatio",
      "aerialAttempts",
      "passRatio",
      "progressivePasses",
      "ballRetention",
    ],
  },
  {
    key: "CM",
    name: "Central Mid",
    RoleClass: CentralMidfielder,
    statKeys: [
      "passRatio",
      "progressivePasses",
      "keyPasses",
      "tackles",
      "tackleRatio",
      "pressuresSuccessful",
      "chancesCreated",
      "npxG",
      "dribbles",
      "distance",
    ],
  },
  {
    key: "AM",
    name: "Attacking Mid",
    RoleClass: AttackingMidfielder,
    statKeys: [
      "keyPasses",
      "progressivePasses",
      "xA",
      "chancesCreated",
      "passRatio",
      "ballRetention",
      "npxG",
      "conversionRatio",
      "dribbles",
    ],
  },
  {
    key: "W",
    name: "Winger",
    RoleClass: Winger,
    statKeys: [
      "crossRatio",
      "crossesSuccessful",
      "xA",
      "chancesCreated",
      "dribbles",
      "sprints",
      "npxG",
      "conversionRatio",
      "keyPasses",
    ],
  },
  {
    key: "ST",
    name: "Striker",
    RoleClass: Striker,
    statKeys: [
      "goals",
      "npxG",
      "xGOverperformance",
      "shots",
      "conversionRatio",
      "xA",
      "chancesCreated",
      "headersWonRatio",
      "dribbles",
    ],
  },
];

export const INVERTED_STATS = new Set([
  "mistakes",
  "possessionLost",
  "concededPer90",
]);

export const STAT_LABELS: Record<string, string> = {
  saveRatio: "Save Ratio",
  expectedSaveRatio: "Expected Save Ratio",
  saveRatioOverExpected: "Save Ratio Over Exp.",
  goalsPrevented: "Goals Prevented",
  savesHeldRatio: "Saves Held Ratio",
  passRatio: "Pass Ratio",
  progressivePasses: "Prog. Passes",
  keyPasses: "Key Passes",
  tackles: "Tackles",
  tackleRatio: "Tackle Ratio",
  pressuresSuccessful: "Pressures",
  headersWonRatio: "Headers Won Ratio",
  aerialAttempts: "Aerial Attempts",
  keyHeaders: "Key Headers",
  crossRatio: "Cross Ratio",
  crossesSuccessful: "Crosses",
  xA: "xA",
  chancesCreated: "Chances Created",
  dribbles: "Dribbles",
  sprints: "Sprints",
  npxG: "npxG",
  conversionRatio: "Conversion Ratio",
  goals: "Goals",
  xGOverperformance: "xG Over",
  shots: "Shots",
  ballRetention: "Ball Retention",
  concededPer90: "Conceded",
  savesPer90: "Saves",
  mistakes: "Mistakes",
  distance: "Distance",
};
