import { type PlayerPositions } from "../fields/positions";

export type Player = {
  UID: number;
  Name: string;
  Age: number;
  Weight: number;
  Height: number;
  RcInjury: boolean;
  Nat: string;
  Division: string;
  Club: string;
  Wage: number;
  Expires: Date | null;
  Position: PlayerPositions;
  CustomPosition?: PlayerPositions;
  SecPosition: PlayerPositions | null;
  Starts: number;
  Mins: number;
  PasPercentage: number | null;
  AssistsPer90: number | null;
  xAPer90: number | null;
  PrPassesPer90: number | null;
  OPKPPer90: number | null;
  ChCPer90: number;
  OPCrPercentage: number;
  OPCrsCPer90: number;
  ConvPercentage: number;
  xGOP: number | null;
  ShTPer90: number | null;
  ShotsOutsideBoxPer90: number | null;
  goals90: number | null;
  NPxGPer90: number | null;
  GlMst: number;
  TckPer90: number | null;
  TckR: number;
  IntPer90: number;
  ClrPer90: number;
  KTckPer90: number;
  KHdrsPer90: number;
  AerAPer90: number;
  HdrPercentage: number;
  HdrsWPer90: number;
  BlkPer90: number;
  PossWonPer90: number;
  PossLostPer90: number;
  SprintsPer90: number;
  DrbPer90: number;
  DistPer90: number;
  PresCPer90: number;
  PresAPer90: number;
  Svt: number;
  Svp: number;
  Svh: number;
  xGPPer90: number;
  exsvPercentage: number | null;
  svPercentage: number | null;
  ConPer90: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Table<T extends Record<string, any>> = Array<T>;

export type KeyOfType<T, V> = keyof {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T as T[P] extends V ? P : never]: any;
};

export interface LeagueRanking {
  rank: number; // 1-6
  league: string; // Division name
}
