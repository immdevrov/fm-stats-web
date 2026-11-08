import type { Player } from "../types";
import {
  type IAerialStats,
  type IPossessionStats,
  type IPassingStats,
  type IDefensiveStats,
  type ICreativeStats,
  type IAttackingStats,
  type IMovementStats,
  type ICrossingStats,
  extractAerialStats,
  extractPossessionStats,
  extractPassingStats,
  extractDefensiveStats,
  extractCreativeStats,
  extractAttackingStats,
  extractMovementStats,
  extractCrossingStats,
} from "../types/stat-categories";
import { getEffectivePosition } from "../utils/utils";
import { type IRole, Role } from "./_role";

export interface IWinger
  extends IRole,
    Pick<IAerialStats, "headersWonRatio" | "aerialAttempts">,
    IPossessionStats,
    IPassingStats,
    Pick<IDefensiveStats, "pressureRatio" | "pressuresAttempted">,
    ICreativeStats,
    Pick<IAttackingStats, "npxG" | "conversionRatio">,
    IMovementStats,
    ICrossingStats {}

export class Winger extends Role implements IWinger {
  // Aerial stats (partial)
  readonly headersWonRatio: number;
  readonly aerialAttempts: number;

  // Possession stats
  readonly possessionWon: number;
  readonly possessionLost: number;

  // Passing stats
  readonly passRatio: number;
  readonly progressivePasses: number;
  readonly keyPasses: number;

  // Defensive stats (partial)
  readonly pressureRatio: number;
  readonly pressuresAttempted: number;
  readonly defensiveContributions: number;

  // Creative stats
  readonly xA: number;
  readonly chancesCreated: number;

  // Attacking stats (partial)
  readonly npxG: number;
  readonly conversionRatio: number;

  // Movement stats
  readonly dribbles: number;
  readonly sprints: number;

  // Crossing stats
  readonly crossRatio: number;
  readonly crossesSuccessful: number;

  constructor(player: Player) {
    super(player);

    const aerialStats = extractAerialStats(player);
    this.headersWonRatio = aerialStats.headersWonRatio;
    this.aerialAttempts = aerialStats.aerialAttempts;

    const possessionStats = extractPossessionStats(player);
    this.possessionWon = possessionStats.possessionWon;
    this.possessionLost = possessionStats.possessionLost;

    const passStats = extractPassingStats(player);
    this.passRatio = passStats.passRatio;
    this.progressivePasses = passStats.progressivePasses;
    this.keyPasses = passStats.keyPasses;

    const defensiveStats = extractDefensiveStats(player);
    this.pressureRatio = defensiveStats.pressureRatio;
    this.pressuresAttempted = defensiveStats.pressuresAttempted;
    this.defensiveContributions = defensiveStats.defensiveContributions;

    const creativeStats = extractCreativeStats(player);
    this.xA = creativeStats.xA;
    this.chancesCreated = creativeStats.chancesCreated;

    const attackingStats = extractAttackingStats(player);
    this.npxG = attackingStats.npxG;
    this.conversionRatio = attackingStats.conversionRatio;

    const movementStats = extractMovementStats(player);
    this.dribbles = movementStats.dribbles;
    this.sprints = movementStats.sprints;

    const crossingStats = extractCrossingStats(player);
    this.crossRatio = crossingStats.crossRatio;
    this.crossesSuccessful = crossingStats.crossesSuccessful;
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some(
      (p) =>
        (p.type === "AM" || p.type === "M") &&
        (p.side?.includes("L") || p.side?.includes("R"))
    );
  }
}

export class LeftWinger extends Winger {
  readonly side = "left";

  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some(
      (p) => (p.type === "AM" || p.type === "M") && p.side?.includes("L")
    );
  }
}

export class RightWinger extends Winger {
  readonly side = "right";

  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some(
      (p) => (p.type === "AM" || p.type === "M") && p.side?.includes("R")
    );
  }
}
