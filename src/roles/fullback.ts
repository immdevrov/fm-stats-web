import type { Player } from "../types";
import {
  type IAerialStats,
  type IPossessionStats,
  type IPassingStats,
  type IDefensiveStats,
  type ICreativeStats,
  type IMovementStats,
  type ICrossingStats,
  type IErrorStats,
  extractAerialStats,
  extractPossessionStats,
  extractPassingStats,
  extractDefensiveStats,
  extractCreativeStats,
  extractMovementStats,
  extractCrossingStats,
  extractErrorStats,
} from "../types/stat-categories";
import { getEffectivePosition } from "../utils/utils";
import { type IRole, Role } from "./_role";

export interface IFullback
  extends IRole,
    IAerialStats,
    IPossessionStats,
    IPassingStats,
    IDefensiveStats,
    Pick<ICreativeStats, "xA">,
    IMovementStats,
    ICrossingStats,
    IErrorStats {}

export class Fullback extends Role implements IFullback {
  // Aerial stats
  readonly headersWonRatio: number;
  readonly aerialAttempts: number;
  readonly keyHeaders: number;

  // Possession stats
  readonly possessionWon: number;
  readonly possessionLost: number;

  // Passing stats
  readonly passRatio: number;
  readonly progressivePasses: number;
  readonly keyPasses: number;

  // Defensive stats
  readonly tackles: number;
  readonly tackleRatio: number;
  readonly pressureRatio: number;
  readonly pressuresAttempted: number;
  readonly defensiveContributions: number;

  // Creative stats (partial)
  readonly xA: number;

  // Movement stats
  readonly dribbles: number;
  readonly sprints: number;

  // Crossing stats
  readonly crossRatio: number;
  readonly crossesSuccessful: number;

  // Error stats
  readonly mistakes: number;

  constructor(player: Player) {
    super(player);

    const aerialStats = extractAerialStats(player);
    this.headersWonRatio = aerialStats.headersWonRatio;
    this.aerialAttempts = aerialStats.aerialAttempts;
    this.keyHeaders = aerialStats.keyHeaders;

    const possessionStats = extractPossessionStats(player);
    this.possessionWon = possessionStats.possessionWon;
    this.possessionLost = possessionStats.possessionLost;

    const passStats = extractPassingStats(player);
    this.passRatio = passStats.passRatio;
    this.progressivePasses = passStats.progressivePasses;
    this.keyPasses = passStats.keyPasses;

    const defensiveStats = extractDefensiveStats(player);
    this.tackles = defensiveStats.tackles;
    this.tackleRatio = defensiveStats.tackleRatio;
    this.pressureRatio = defensiveStats.pressureRatio;
    this.pressuresAttempted = defensiveStats.pressuresAttempted;
    this.defensiveContributions = defensiveStats.defensiveContributions;

    const creativeStats = extractCreativeStats(player);
    this.xA = creativeStats.xA;

    const movementStats = extractMovementStats(player);
    this.dribbles = movementStats.dribbles;
    this.sprints = movementStats.sprints;

    const crossingStats = extractCrossingStats(player);
    this.crossRatio = crossingStats.crossRatio;
    this.crossesSuccessful = crossingStats.crossesSuccessful;

    const errorStats = extractErrorStats(player);
    this.mistakes = errorStats.mistakes;
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some(
      (p) =>
        (p.type === "D" || p.type === "WB") &&
        (p.side?.includes("L") || p.side?.includes("R"))
    );
  }
}

export class LeftFullback extends Fullback {
  readonly side = "left";

  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some((p) => p.type === "D" && p.side?.includes("L"));
  }
}

export class RightFullback extends Fullback {
  readonly side = "right";

  constructor(player: Player) {
    super(player);
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some((p) => p.type === "D" && p.side?.includes("R"));
  }
}
