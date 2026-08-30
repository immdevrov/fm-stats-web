import type { PlayerPosition } from '../fields/positions';

export interface FormationSlot {
  id: string;
  position: PlayerPosition;
  row: number;
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

const GK: FormationSlot = { id: 'GK', position: { type: 'GK' }, row: 0 };

function back4(row: number): FormationSlot[] {
  return [
    { id: 'D-L', position: { type: 'D', side: ['L'] }, row },
    { id: 'D-C-1', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-C-2', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-R', position: { type: 'D', side: ['R'] }, row },
  ];
}

function back3(row: number): FormationSlot[] {
  return [
    { id: 'D-C-1', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-C-2', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-C-3', position: { type: 'D', side: ['C'] }, row },
  ];
}

export const FORMATIONS: Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2',
    slots: [
      GK,
      ...back4(1),
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 2 },
      { id: 'ST-C-1', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'ST-C-2', position: { type: 'ST', side: ['C'] }, row: 3 },
    ],
  },
  {
    id: '4-4-1-1',
    name: '4-4-1-1',
    slots: [
      GK,
      ...back4(1),
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 2 },
      { id: 'AM-C', position: { type: 'AM', side: ['C'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 4 },
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    slots: [
      GK,
      ...back4(1),
      { id: 'DM-C-1', position: { type: 'DM', side: ['C'] }, row: 2 },
      { id: 'DM-C-2', position: { type: 'DM', side: ['C'] }, row: 2 },
      { id: 'AM-L', position: { type: 'AM', side: ['L'] }, row: 3 },
      { id: 'AM-C', position: { type: 'AM', side: ['C'] }, row: 3 },
      { id: 'AM-R', position: { type: 'AM', side: ['R'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 4 },
    ],
  },
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    slots: [
      GK,
      ...back4(1),
      { id: 'DM-C', position: { type: 'DM', side: ['C'] }, row: 2 },
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 3 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 3 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 3 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 4 },
    ],
  },
  {
    id: '4-3-3',
    name: '4-3-3',
    slots: [
      GK,
      ...back4(1),
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-3', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'AM-L', position: { type: 'AM', side: ['L'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'AM-R', position: { type: 'AM', side: ['R'] }, row: 3 },
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    slots: [
      GK,
      ...back3(1),
      { id: 'WB-L', position: { type: 'WB', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-3', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'WB-R', position: { type: 'WB', side: ['R'] }, row: 2 },
      { id: 'ST-C-1', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'ST-C-2', position: { type: 'ST', side: ['C'] }, row: 3 },
    ],
  },
  {
    id: '5-3-2',
    name: '5-3-2',
    slots: [
      GK,
      { id: 'WB-L', position: { type: 'WB', side: ['L'] }, row: 1 },
      ...back3(1),
      { id: 'WB-R', position: { type: 'WB', side: ['R'] }, row: 1 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-3', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'ST-C-1', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'ST-C-2', position: { type: 'ST', side: ['C'] }, row: 3 },
    ],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    slots: [
      GK,
      ...back3(1),
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 2 },
      { id: 'AM-L', position: { type: 'AM', side: ['L'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'AM-R', position: { type: 'AM', side: ['R'] }, row: 3 },
    ],
  },
];

export function getFormation(id: string): Formation | undefined {
  return FORMATIONS.find((formation) => formation.id === id);
}
