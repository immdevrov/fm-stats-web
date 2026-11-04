import type { PlayerPositions } from '../fields/positions';

export type TransferMark = 'in' | 'out';

export interface PlayerAnnotation {
  uid: number;
  customPosition?: PlayerPositions;
  unwanted?: boolean;
  transfer?: TransferMark;
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
