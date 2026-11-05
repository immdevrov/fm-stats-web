import type { PlayerPosition } from '../fields/positions';
import type { SquadPlan } from '../types/planner';
import { OUTFIELD_ROWS, GK_CELL, cellKey, cellPosition, type Cell } from './grid';

export interface FormationSlot {
  id: string;
  cell: Cell;
  position: PlayerPosition;
}

export interface Preset {
  id: string;
  name: string;
  slots: Array<{ id: string; cell: Cell }>;
}

type PresetSlot = Preset['slots'][number];

const slot = (id: string, row: Cell['row'], col: number): PresetSlot => ({ id, cell: { row, col } });

const GK = slot('GK', GK_CELL.row, GK_CELL.col);

const back4 = (): PresetSlot[] => [
  slot('D-L', 'D', 0),
  slot('D-C-1', 'D', 1),
  slot('D-C-2', 'D', 3),
  slot('D-R', 'D', 4),
];

const back3 = (): PresetSlot[] => [
  slot('D-C-1', 'D', 1),
  slot('D-C-2', 'D', 2),
  slot('D-C-3', 'D', 3),
];

const mid4 = (): PresetSlot[] => [
  slot('M-L', 'M', 0),
  slot('M-C-1', 'M', 1),
  slot('M-C-2', 'M', 3),
  slot('M-R', 'M', 4),
];

const mid3 = (): PresetSlot[] => [
  slot('M-C-1', 'M', 1),
  slot('M-C-2', 'M', 2),
  slot('M-C-3', 'M', 3),
];

const front3 = (): PresetSlot[] => [
  slot('AM-L', 'AM', 0),
  slot('ST-C', 'ST', 2),
  slot('AM-R', 'AM', 4),
];

const preset = (id: string, slots: PresetSlot[]): Preset => ({ id, name: id, slots });

export const PRESETS: Preset[] = [
  preset('4-4-2', [GK, ...back4(), ...mid4(), slot('ST-C-1', 'ST', 1), slot('ST-C-2', 'ST', 3)]),
  preset('4-4-1-1', [GK, ...back4(), ...mid4(), slot('AM-C', 'AM', 2), slot('ST-C', 'ST', 2)]),
  preset('4-2-3-1', [
    GK,
    ...back4(),
    slot('DM-C-1', 'DM', 1),
    slot('DM-C-2', 'DM', 3),
    slot('AM-L', 'AM', 0),
    slot('AM-C', 'AM', 2),
    slot('AM-R', 'AM', 4),
    slot('ST-C', 'ST', 2),
  ]),
  preset('4-1-4-1', [
    GK,
    ...back4(),
    slot('DM-C', 'DM', 2),
    slot('M-L', 'M', 0),
    slot('M-C-1', 'M', 1),
    slot('M-C-2', 'M', 3),
    slot('M-R', 'M', 4),
    slot('ST-C', 'ST', 2),
  ]),
  preset('4-3-3', [GK, ...back4(), ...mid3(), ...front3()]),
  preset('3-5-2', [
    GK,
    ...back3(),
    slot('WB-L', 'DM', 0),
    slot('WB-R', 'DM', 4),
    ...mid3(),
    slot('ST-C-1', 'ST', 1),
    slot('ST-C-2', 'ST', 3),
  ]),
  preset('3-4-3', [GK, ...back3(), ...mid4(), ...front3()]),
];

const LEGACY_ALIASES: Record<string, string> = { '5-3-2': '3-5-2' };

export function getPreset(id: string): Preset | undefined {
  const resolved = LEGACY_ALIASES[id] ?? id;
  return PRESETS.find((candidate) => candidate.id === resolved);
}

export function boardSlots(plan: SquadPlan): FormationSlot[] {
  return plan.slots.map((planned) => ({
    id: planned.slotId,
    cell: planned.cell,
    position: cellPosition(planned.cell),
  }));
}

export function presetFor(cells: Cell[]): Preset | undefined {
  const keys = new Set(cells.map(cellKey));
  return PRESETS.find(
    (candidate) =>
      candidate.slots.length === cells.length &&
      candidate.slots.every((s) => keys.has(cellKey(s.cell)))
  );
}

export function shapeName(cells: Cell[]): string {
  const matched = presetFor(cells);
  if (matched) return matched.name;
  return OUTFIELD_ROWS.map((row) => cells.filter((cell) => cell.row === row).length)
    .filter((count) => count > 0)
    .join('-');
}
