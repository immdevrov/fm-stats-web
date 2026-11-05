import type { Cell } from "../formations/grid";

export const MAX_DEPTH = 3;

export interface PlannedPlayer {
  uid: number;
  name: string;
  club: string;
}

export interface PlannedSlot {
  slotId: string;
  cell: Cell;
  players: PlannedPlayer[];
}

export type HorizonPreset = "now" | "season" | "1y" | "2y";

export interface SquadPlan {
  horizon: HorizonPreset | null;
  slots: PlannedSlot[];
}
