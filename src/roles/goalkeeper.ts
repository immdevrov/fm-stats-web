import type { Player } from "../types";
import {
  type IGoalkeeperStats,
  type IPassingStats,
  type IPhysicalStats,
  type IErrorStats,
  extractGoalkeeperStats,
  extractPassingStats,
  extractPhysicalStats,
  extractErrorStats,
} from "../types/stat-categories";
import { getEffectivePosition } from "../utils/utils";
import { type IRole, Role } from "./_role";

export interface IGoalkeeper
  extends IRole,
    IGoalkeeperStats,
    Pick<IPassingStats, "passRatio" | "progressivePasses">,
    IPhysicalStats,
    IErrorStats {
  /** goals conceded per 90 */
  concededPer90: number;
  /** total saves per 90 minutes */
  savesPer90: number;
  /** saveRatio - expectedSaveRatio */
  saveRatioOverExpected: number;
}

export class GoalKeeper extends Role implements IGoalkeeper {
  // Goalkeeper stats
  readonly goalsPrevented: number;
  readonly saveRatio: number;
  readonly expectedSaveRatio: number;
  readonly savesHeldRatio: number;
  readonly concededPer90: number;
  readonly savesPer90: number;

  // Passing stats
  readonly passRatio: number;
  readonly progressivePasses: number;

  // Physical stats
  readonly height: number;

  // Error stats
  readonly mistakes: number;

  // Computed
  readonly saveRatioOverExpected: number;

  constructor(player: Player) {
    super(player);

    const gkStats = extractGoalkeeperStats(player);
    this.goalsPrevented = gkStats.goalsPrevented;
    this.saveRatio = gkStats.saveRatio;
    this.expectedSaveRatio = gkStats.expectedSaveRatio;
    this.savesHeldRatio = gkStats.savesHeldRatio;
    this.concededPer90 = gkStats.concededPer90;
    this.savesPer90 = gkStats.savesPer90;

    const passStats = extractPassingStats(player);
    this.passRatio = passStats.passRatio;
    this.progressivePasses = passStats.progressivePasses;

    const physicalStats = extractPhysicalStats(player);
    this.height = physicalStats.height;

    const errorStats = extractErrorStats(player);
    this.mistakes = errorStats.mistakes;

    // Computed stats
    this.saveRatioOverExpected = this.saveRatio - this.expectedSaveRatio;
  }

  static isRole(player: Player): boolean {
    return getEffectivePosition(player).some((p) => p.type === "GK");
  }
}
