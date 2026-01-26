import type { Player } from "../types";
import {
  type IAerialStats,
  type IPossessionStats,
  type IPassingStats,
  type IDefensiveStats,
  type ICreativeStats,
  type IAttackingStats,
  type IMovementStats,
  extractAerialStats,
  extractPossessionStats,
  extractPassingStats,
  extractDefensiveStats,
  extractCreativeStats,
  extractAttackingStats,
  extractMovementStats,
} from "../types/stat-categories";
import { type IRole, Role } from "./_role";

export interface IWinger
  extends IRole,
    Pick<IAerialStats, "headersWonRatio" | "aerialAttempts">,
    IPossessionStats,
    IPassingStats,
    Pick<IDefensiveStats, "pressuresSuccessful">,
    ICreativeStats,
    Pick<IAttackingStats, "npxG" | "conversionRatio">,
    IMovementStats {}

export class Winger extends Role implements IWinger {
  // Aerial stats (partial)
  readonly headersWonRatio: number;
  readonly aerialAttempts: number;

  // Possession stats
  readonly possessionWon: number;
  readonly possessionLost: number;
  readonly ballRetention: number;

  // Passing stats
  readonly passRatio: number;
  readonly progressivePasses: number;
  readonly keyPasses: number;

  // Defensive stats (partial)
  readonly pressuresSuccessful: number;

  // Creative stats
  readonly xA: number;
  readonly chancesCreated: number;

  // Attacking stats (partial)
  readonly npxG: number;
  readonly conversionRatio: number;

  // Movement stats
  readonly dribbles: number;
  readonly sprints: number;
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
    this.ballRetention = possessionStats.ballRetention;

    const passStats = extractPassingStats(player);
    this.passRatio = passStats.passRatio;
    this.progressivePasses = passStats.progressivePasses;
    this.keyPasses = passStats.keyPasses;

    const defensiveStats = extractDefensiveStats(player);
    this.pressuresSuccessful = defensiveStats.pressuresSuccessful;

    const creativeStats = extractCreativeStats(player);
    this.xA = creativeStats.xA;
    this.chancesCreated = creativeStats.chancesCreated;

    const attackingStats = extractAttackingStats(player);
    this.npxG = attackingStats.npxG;
    this.conversionRatio = attackingStats.conversionRatio;

    const movementStats = extractMovementStats(player);
    this.dribbles = movementStats.dribbles;
    this.sprints = movementStats.sprints;
    this.crossRatio = movementStats.crossRatio;
    this.crossesSuccessful = movementStats.crossesSuccessful;
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
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
    return player.Position.some(
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
    return player.Position.some(
      (p) => (p.type === "AM" || p.type === "M") && p.side?.includes("R")
    );
  }
}
