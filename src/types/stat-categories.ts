import type { Player } from "./types";
import { safeNumber } from "../utils";

/**
 * Stat Category Interfaces
 *
 * All stats in these interfaces are PER 90 MINUTES unless otherwise noted
 * in the property documentation.
 */

export interface IAerialStats {
  /** % of aerial duels won */
  headersWonRatio: number;
  /** aerial duels attempted */
  aerialAttempts: number;
  /** headers leading to chances */
  keyHeaders: number;
}

export interface IPossessionStats {
  /** times won possession */
  possessionWon: number;
  /** times lost possession */
  possessionLost: number;
  /** computed: won - lost */
  ballRetention: number;
}

export interface IPassingStats {
  /** % passes completed */
  passRatio: number;
  /** passes moving ball forward */
  progressivePasses: number;
  /** passes leading to shots */
  keyPasses: number;
}

export interface IDefensiveStats {
  /** tackles attempted */
  tackles: number;
  /** % tackles won */
  tackleRatio: number;
  /** successful pressing actions */
  pressuresSuccessful: number;
}

export interface ICreativeStats {
  /** expected assists */
  xA: number;
  /** chances created */
  chancesCreated: number;
}

export interface IAttackingStats {
  /** goals scored */
  goals: number;
  /** non-penalty expected goals */
  npxG: number;
  /** goals minus xG */
  xGOverperformance: number;
  /** shots taken */
  shots: number;
  /** % shots converted to goals */
  conversionRatio: number;
}

export interface IMovementStats {
  /** successful dribbles */
  dribbles: number;
  /** sprint actions */
  sprints: number;
  /** % crosses completed */
  crossRatio: number;
  /** successful crosses */
  crossesSuccessful: number;
}

export interface IGoalkeeperStats {
  /** xG prevented */
  goalsPrevented: number;
  /** % shots saved */
  saveRatio: number;
  /** expected save % */
  expectedSaveRatio: number;
  /** % saves caught (not parried) */
  savesHeldRatio: number;
}

export interface IPhysicalStats {
  /** in cm (not per 90) */
  height: number;
  /** years (not per 90) */
  age: number;
}

export interface IErrorStats {
  /** mistakes leading to goals */
  mistakes: number;
}

/**
 * Mapping from canonical stat names to Player property names.
 * Used for documentation and potential runtime mapping.
 */
export const STAT_MAPPING = {
  // Aerial
  headersWonRatio: "HdrPercentage",
  aerialAttempts: "AerAPer90",
  keyHeaders: "KHdrsPer90",

  // Possession
  possessionWon: "PossWonPer90",
  possessionLost: "PossLostPer90",
  // ballRetention is computed

  // Passing
  passRatio: "PasPercentage",
  progressivePasses: "PrPassesPer90",
  keyPasses: "OPKPPer90",

  // Defensive
  tackles: "TckPer90",
  tackleRatio: "TckR",
  pressuresSuccessful: "PresCPer90",

  // Creative
  xA: "xAPer90",
  chancesCreated: "ChCPer90",

  // Attacking
  goals: "goals90",
  npxG: "NPxGPer90",
  xGOverperformance: "xGOP",
  shots: "ShTPer90",
  conversionRatio: "ConvPercentage",

  // Movement
  dribbles: "DrbPer90",
  sprints: "SprintsPer90",
  crossRatio: "OPCrPercentage",
  crossesSuccessful: "OPCrsCPer90",

  // Goalkeeper
  goalsPrevented: "xGPPer90",
  saveRatio: "svPercentage",
  expectedSaveRatio: "exsvPercentage",
  // savesHeldRatio is computed

  // Physical
  height: "Height",
  age: "Age",

  // Error
  mistakes: "GlMst",
} as const;

/**
 * Extraction Functions
 *
 * These functions extract stat categories from a Player object,
 * mapping from the Player's raw property names to canonical names.
 */

export function extractAerialStats(player: Player): IAerialStats {
  return {
    headersWonRatio: safeNumber(player.HdrPercentage),
    aerialAttempts: safeNumber(player.AerAPer90),
    keyHeaders: safeNumber(player.KHdrsPer90),
  };
}

export function extractPossessionStats(player: Player): IPossessionStats {
  const possessionWon = safeNumber(player.PossWonPer90);
  const possessionLost = safeNumber(player.PossLostPer90);
  return {
    possessionWon,
    possessionLost,
    ballRetention: possessionWon - possessionLost,
  };
}

export function extractPassingStats(player: Player): IPassingStats {
  return {
    passRatio: safeNumber(player.PasPercentage),
    progressivePasses: safeNumber(player.PrPassesPer90),
    keyPasses: safeNumber(player.OPKPPer90),
  };
}

export function extractDefensiveStats(player: Player): IDefensiveStats {
  return {
    tackles: safeNumber(player.TckPer90),
    tackleRatio: safeNumber(player.TckR),
    pressuresSuccessful: safeNumber(player.PresCPer90),
  };
}

export function extractCreativeStats(player: Player): ICreativeStats {
  return {
    xA: safeNumber(player.xAPer90),
    chancesCreated: safeNumber(player.ChCPer90),
  };
}

export function extractAttackingStats(player: Player): IAttackingStats {
  return {
    goals: safeNumber(player.goals90),
    npxG: safeNumber(player.NPxGPer90),
    xGOverperformance: safeNumber(player.xGOP),
    shots: safeNumber(player.ShTPer90),
    conversionRatio: safeNumber(player.ConvPercentage),
  };
}

export function extractMovementStats(player: Player): IMovementStats {
  return {
    dribbles: safeNumber(player.DrbPer90),
    sprints: safeNumber(player.SprintsPer90),
    crossRatio: safeNumber(player.OPCrPercentage),
    crossesSuccessful: safeNumber(player.OPCrsCPer90),
  };
}

export function extractGoalkeeperStats(player: Player): IGoalkeeperStats {
  const svh = safeNumber(player.Svh);
  const svp = safeNumber(player.Svp);
  const svt = safeNumber(player.Svt);
  const saves = svh + svp + svt;
  const savesHeldRatio =
    saves === 0 ? 0 : Math.round((svh / saves + Number.EPSILON) * 100) / 100;

  return {
    goalsPrevented: safeNumber(player.xGPPer90),
    saveRatio: safeNumber(player.svPercentage),
    expectedSaveRatio: safeNumber(player.exsvPercentage),
    savesHeldRatio,
  };
}

export function extractPhysicalStats(player: Player): IPhysicalStats {
  return {
    height: safeNumber(player.Height),
    age: safeNumber(player.Age),
  };
}

export function extractErrorStats(player: Player): IErrorStats {
  return {
    mistakes: safeNumber(player.GlMst),
  };
}
