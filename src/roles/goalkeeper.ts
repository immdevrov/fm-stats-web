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
import { type IRole, Role } from "./_role";

export interface IGoalkeeper
  extends IRole,
    IGoalkeeperStats,
    Pick<IPassingStats, "passRatio" | "progressivePasses">,
    IPhysicalStats,
    IErrorStats {
  /** saveRatio - expectedSaveRatio */
  saveRatioOverExpected: number;
}

export class GoalKeeper extends Role implements IGoalkeeper {
  // Goalkeeper stats
  readonly goalsPrevented: number;
  readonly saveRatio: number;
  readonly expectedSaveRatio: number;
  readonly savesHeldRatio: number;

  // Passing stats
  readonly passRatio: number;
  readonly progressivePasses: number;

  // Physical stats
  readonly height: number;
  readonly age: number;

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

    const passStats = extractPassingStats(player);
    this.passRatio = passStats.passRatio;
    this.progressivePasses = passStats.progressivePasses;

    const physicalStats = extractPhysicalStats(player);
    this.height = physicalStats.height;
    this.age = physicalStats.age;

    const errorStats = extractErrorStats(player);
    this.mistakes = errorStats.mistakes;

    // Computed stats
    this.saveRatioOverExpected = this.saveRatio - this.expectedSaveRatio;
  }

  static isRole(player: Player): boolean {
    return player.Position.some((p) => p.type === "GK");
  }
}
