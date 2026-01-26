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

export interface IStriker
  extends IRole,
    Pick<IAerialStats, "headersWonRatio" | "aerialAttempts" | "keyHeaders">,
    Pick<IPossessionStats, "possessionWon" | "ballRetention">,
    IAttackingStats,
    ICreativeStats,
    Pick<IDefensiveStats, "tackleRatio" | "pressuresSuccessful">,
    Pick<IPassingStats, "keyPasses">,
    Pick<IMovementStats, "dribbles"> {}

export class Striker extends Role implements IStriker {
  // Aerial stats (partial)
  readonly headersWonRatio: number;
  readonly aerialAttempts: number;
  readonly keyHeaders: number;

  // Possession stats (partial)
  readonly possessionWon: number;
  readonly ballRetention: number;

  // Attacking stats
  readonly goals: number;
  readonly npxG: number;
  readonly xGOverperformance: number;
  readonly shots: number;
  readonly conversionRatio: number;

  // Creative stats
  readonly xA: number;
  readonly chancesCreated: number;

  // Defensive stats (partial)
  readonly tackleRatio: number;
  readonly pressuresSuccessful: number;

  // Passing stats (partial)
  readonly keyPasses: number;

  // Movement stats (partial)
  readonly dribbles: number;

  constructor(player: Player) {
    super(player);

    const aerialStats = extractAerialStats(player);
    this.headersWonRatio = aerialStats.headersWonRatio;
    this.aerialAttempts = aerialStats.aerialAttempts;
    this.keyHeaders = aerialStats.keyHeaders;

    const possessionStats = extractPossessionStats(player);
    this.possessionWon = possessionStats.possessionWon;
    this.ballRetention = possessionStats.ballRetention;

    const attackingStats = extractAttackingStats(player);
    this.goals = attackingStats.goals;
    this.npxG = attackingStats.npxG;
    this.xGOverperformance = attackingStats.xGOverperformance;
    this.shots = attackingStats.shots;
    this.conversionRatio = attackingStats.conversionRatio;

    const creativeStats = extractCreativeStats(player);
    this.xA = creativeStats.xA;
    this.chancesCreated = creativeStats.chancesCreated;

    const defensiveStats = extractDefensiveStats(player);
    this.tackleRatio = defensiveStats.tackleRatio;
    this.pressuresSuccessful = defensiveStats.pressuresSuccessful;

    const passStats = extractPassingStats(player);
    this.keyPasses = passStats.keyPasses;

    const movementStats = extractMovementStats(player);
    this.dribbles = movementStats.dribbles;
  }

  static isRole(player: Player): boolean {
    return player.Position.some((p) => p.type === "ST");
  }
}
