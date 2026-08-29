import type { PlayerPositions } from '../fields/positions';

export interface PlayerAnnotation {
  uid: number;
  customPosition?: PlayerPositions;
  unwanted?: boolean;
  price?: number;
  wageDemand?: number;
  note?: string;
  lastKnownName?: string;
  lastKnownClub?: string;
}

export interface PlayerList {
  id: string;
  name: string;
  order: number;
  uids: number[];
  createdAt: Date;
}
