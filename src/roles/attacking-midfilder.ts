import type { Player } from "../types";
import {
  type IPossessionStats,
  type IPassingStats,
  type ICreativeStats,
  type IAttackingStats,
  type IMovementStats,
  extractPossessionStats,
  extractPassingStats,
  extractCreativeStats,
  extractAttackingStats,
  extractMovementStats,
} from "../types/stat-categories";
import { getEffectivePosition } from "../utils/utils";
import { type IRole, Role } from "./_role";

export interface IAttackingMidfielder
  extends IRole,
    IPossessionStats,
    IPassingStats,
    ICreativeStats,
    Pick<IAttackingStats, "npxG" | "conversionRatio">,
    Pick<IMovementStats, "dribbles"> {}

export class AttackingMidfielder extends Role implements IAttackingMidfielder {
  // Possession stats
  readonly possessionWon: number;
  readonly possessionLost: number;
  readonly ballRetention: number;

  // Passing stats
  readonly passRatio: number;
  readonly progressivePasses: number;
  readonly keyPasses: number;

  // Creative stats
  readonly xA: number;
  readonly chancesCreated: number;

  // Attacking stats (partial)
  readonly npxG: number;
  readonly conversionRatio: number;

  // Movement stats (partial)
  readonly dribbles: number;

  constructor(player: Player) {
    super(player);

    const possessionStats = extractPossessionStats(player);
    this.possessionWon = possessionStats.possessionWon;
    this.possessionLost = possessionStats.possessionLost;
    this.ballRetention = possessionStats.ballRetention;

    const passStats = extractPassingStats(player);
    this.passRatio = passStats.passRatio;
    this.progressivePasses = passStats.progressivePasses;
    this.keyPasses = passStats.keyPasses;

    const creativeStats = extractCreativeStats(player);
    this.xA = creativeStats.xA;
    this.chancesCreated = creativeStats.chancesCreated;

    const attackingStats = extractAttackingStats(player);
    this.npxG = attackingStats.npxG;
    this.conversionRatio = attackingStats.conversionRatio;

    const movementStats = extractMovementStats(player);
    this.dribbles = movementStats.dribbles;
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some(
      (p) => (p.type === "M" || p.type === "AM") && p.side?.includes("C")
    );
  }
}
