import type { Player } from "../types";
import {
  type IAerialStats,
  type IPossessionStats,
  type IPassingStats,
  type IDefensiveStats,
  extractAerialStats,
  extractPossessionStats,
  extractPassingStats,
  extractDefensiveStats,
} from "../types/stat-categories";
import { getEffectivePosition } from "../utils/utils";
import { type IRole, Role } from "./_role";

export interface IDefensiveMidfielder
  extends IRole,
    IAerialStats,
    IPossessionStats,
    IPassingStats,
    IDefensiveStats {}

export class DefensiveMidfielder extends Role implements IDefensiveMidfielder {
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
  readonly defensiveContributions: number;

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
    this.defensiveContributions = defensiveStats.defensiveContributions;
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some(
      (p) => (p.type === "M" && p.side?.includes("C")) || p.type === "DM"
    );
  }
}
