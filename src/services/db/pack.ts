import type { Player } from '../../types/types';

export const PLAYER_FIELDS: readonly string[] = [
  'Name', 'Age', 'Weight', 'Height', 'RcInjury', 'Nat', 'Division', 'Club',
  'Wage', 'Expires', 'Position', 'SecPosition', 'Starts', 'Mins',
  'PasPercentage', 'AssistsPer90', 'xAPer90', 'PrPassesPer90', 'OPKPPer90',
  'ChCPer90', 'OPCrPercentage', 'OPCrsCPer90', 'ConvPercentage', 'xGOP',
  'ShTPer90', 'ShotsOutsideBoxPer90', 'goals90', 'NPxGPer90', 'GlMst',
  'TckPer90', 'TckR', 'IntPer90', 'ClrPer90', 'KTckPer90', 'KHdrsPer90',
  'AerAPer90', 'HdrPercentage', 'HdrsWPer90', 'BlkPer90', 'PossWonPer90',
  'PossLostPer90', 'SprintsPer90', 'DrbPer90', 'DistPer90', 'PresCPer90',
  'PresAPer90', 'Svt', 'Svp', 'Svh', 'xGPPer90', 'exsvPercentage',
  'svPercentage', 'ConPer90',
];

export function pack(player: Player, fields: readonly string[]): unknown[] {
  const record = player as unknown as Record<string, unknown>;
  return fields.map((field) => record[field]);
}

export function unpack(uid: number, values: unknown[], fields: readonly string[]): Player {
  const record: Record<string, unknown> = { UID: uid };
  fields.forEach((field, index) => {
    record[field] = values[index];
  });
  return record as unknown as Player;
}
