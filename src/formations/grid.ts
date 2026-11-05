import type { PlayerPosition } from '../fields/positions';

export type GridRow = 'GK' | 'D' | 'DM' | 'M' | 'AM' | 'ST';

export const OUTFIELD_ROWS: GridRow[] = ['D', 'DM', 'M', 'AM', 'ST'];

export interface Cell {
  row: GridRow;
  col: number;
}

export const GK_CELL: Cell = { row: 'GK', col: 2 };

const ROW_POSITION_TYPE = { D: 'D', DM: 'DM', M: 'M', AM: 'AM', ST: 'ST' } as const;

export function cellPosition(cell: Cell): PlayerPosition {
  if (cell.row === 'GK') return { type: 'GK' };
  const wide = cell.col === 0 ? 'L' : cell.col === 4 ? 'R' : null;
  if (cell.row === 'DM') {
    return wide ? { type: 'WB', side: [wide] } : { type: 'DM', side: ['C'] };
  }
  return { type: ROW_POSITION_TYPE[cell.row], side: [wide ?? 'C'] };
}

export function isPlayableCell(cell: Cell): boolean {
  if (!Number.isInteger(cell.col) || cell.col < 0 || cell.col > 4) return false;
  if (cell.row === 'GK') return cell.col === GK_CELL.col;
  if (cell.row === 'ST') return cell.col >= 1 && cell.col <= 3;
  return true;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

export function cellKey(cell: Cell): string {
  return `${cell.row}-${cell.col}`;
}
