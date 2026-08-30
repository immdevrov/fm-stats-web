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

export interface SquadPlan {
  formationId: string;
  horizon: string | null;
  slots: PlannedSlot[];
}
