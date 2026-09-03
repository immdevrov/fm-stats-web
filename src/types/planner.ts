export const MAX_DEPTH = 3;

export interface PlannedPlayer {
  uid: number;
  name: string;
  club: string;
}

export interface PlannedSlot {
  slotId: string;
  players: PlannedPlayer[];
}

export type HorizonPreset = "now" | "season" | "1y" | "2y";

export interface SquadPlan {
  formationId: string;
  horizon: HorizonPreset | null;
  slots: PlannedSlot[];
}
