import type { PlayerPositions } from '../fields/positions';

export type TransferMark = 'in' | 'out';

export interface PlayerNote {
  id: string;
  text: string;
  date: string | null;
  briefId?: string;
  briefName?: string;
}

export interface PlayerAnnotation {
  uid: number;
  customPosition?: PlayerPositions;
  unwanted?: boolean;
  transfer?: TransferMark;
  price?: number;
  wageDemand?: number;
  notes?: PlayerNote[];
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
