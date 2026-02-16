import type { Player } from "../types";
import {
  type IAerialStats,
  type IPossessionStats,
  type IPassingStats,
  type IDefensiveStats,
  type ICreativeStats,
  type IMovementStats,
  type IPhysicalStats,
  type IErrorStats,
  extractAerialStats,
  extractPossessionStats,
  extractPassingStats,
  extractDefensiveStats,
  extractCreativeStats,
  extractMovementStats,
  extractPhysicalStats,
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
    IPhysicalStats,
    IErrorStats {}

export class Fullback extends Role implements IFullback {
  // Aerial stats
  readonly headersWonRatio: number;
  readonly aerialAttempts: number;
  readonly keyHeaders: number;

  // Possession stats
  readonly possessionWon: number;
  readonly possessionLost: number;
  readonly ballRetention: number;

  // Passing stats
  readonly passRatio: number;
  readonly progressivePasses: number;
  readonly keyPasses: number;

  // Defensive stats
  readonly tackles: number;
  readonly tackleRatio: number;
  readonly pressuresSuccessful: number;

  // Creative stats (partial)
  readonly xA: number;

  // Movement stats
  readonly dribbles: number;
  readonly sprints: number;
  readonly crossRatio: number;
  readonly crossesSuccessful: number;

  // Physical stats
  readonly height: number;
  readonly age: number;

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
    this.ballRetention = possessionStats.ballRetention;

    const passStats = extractPassingStats(player);
    this.passRatio = passStats.passRatio;
    this.progressivePasses = passStats.progressivePasses;
    this.keyPasses = passStats.keyPasses;

    const defensiveStats = extractDefensiveStats(player);
    this.tackles = defensiveStats.tackles;
    this.tackleRatio = defensiveStats.tackleRatio;
    this.pressuresSuccessful = defensiveStats.pressuresSuccessful;

    const creativeStats = extractCreativeStats(player);
    this.xA = creativeStats.xA;

    const movementStats = extractMovementStats(player);
    this.dribbles = movementStats.dribbles;
    this.sprints = movementStats.sprints;
    this.crossRatio = movementStats.crossRatio;
    this.crossesSuccessful = movementStats.crossesSuccessful;

    const physicalStats = extractPhysicalStats(player);
    this.height = physicalStats.height;
    this.age = physicalStats.age;

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
