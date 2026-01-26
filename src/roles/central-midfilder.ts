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

export interface ICentralMidfielder
  extends IRole,
    Pick<IAerialStats, "headersWonRatio">,
    IPossessionStats,
    IPassingStats,
    IDefensiveStats,
    Pick<ICreativeStats, "chancesCreated">,
    Pick<IAttackingStats, "npxG">,
    Pick<IMovementStats, "dribbles" | "sprints"> {
  /** distance covered per 90 */
  distance: number;
}

export class CentralMidfielder extends Role implements ICentralMidfielder {
  // Aerial stats (partial)
  readonly headersWonRatio: number;

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
  readonly chancesCreated: number;

  // Attacking stats (partial)
  readonly npxG: number;

  // Movement stats (partial)
  readonly dribbles: number;
  readonly sprints: number;

  // Custom
  readonly distance: number;

  constructor(player: Player) {
    super(player);

    const aerialStats = extractAerialStats(player);
    this.headersWonRatio = aerialStats.headersWonRatio;

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
    this.chancesCreated = creativeStats.chancesCreated;

    const attackingStats = extractAttackingStats(player);
    this.npxG = attackingStats.npxG;

    const movementStats = extractMovementStats(player);
    this.dribbles = movementStats.dribbles;
    this.sprints = movementStats.sprints;

    // Custom stat
    this.distance = player.DistPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) => (p.type === "M" && p.side?.includes("C")) || p.type === "DM"
    );
  }
}
