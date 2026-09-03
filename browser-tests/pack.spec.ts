import { test, expect } from '@playwright/test';
import { parseCustomDate } from '../src/utils/utils';
import { deriveDateFromFilename, displayToIso, isoToDisplay } from '../src/utils/import-date';
import { PLAYER_FIELDS, pack, unpack } from '../src/services/db/pack';
import { sortSnapshots, newestSnapshot } from '../src/utils/snapshot-order';
import { REQUIRED_COLUMNS, findMissingColumns } from '../src/parser/html-parser';
import { resolveHorizon } from '../src/utils/planner';
import type { Player } from '../src/types/types';
import type { Snapshot } from '../src/types/snapshot';

test('parseCustomDate reads the month as written', () => {
  const january = parseCustomDate('24/01/2035');
  expect(january.getFullYear()).toBe(2035);
  expect(january.getMonth()).toBe(0);
  expect(january.getDate()).toBe(24);
});

test('parseCustomDate does not roll December into the next year', () => {
  const december = parseCustomDate('31/12/2035');
  expect(december.getFullYear()).toBe(2035);
  expect(december.getMonth()).toBe(11);
  expect(december.getDate()).toBe(31);
});

function samplePlayer(): Player {
  const player = { UID: 42, Name: 'Test Player' } as Player;
  for (const field of PLAYER_FIELDS) {
    if (field in player) continue;
    (player as unknown as Record<string, unknown>)[field] = 0;
  }
  player.Expires = null;
  player.Position = [{ type: 'D', side: ['R', 'C'] }];
  player.SecPosition = [{ type: 'WB', side: ['R'] }];
  player.RcInjury = true;
  player.Club = 'Test FC';
  player.Nat = 'ENG';
  player.Division = 'Premier League';
  return player;
}

test('pack and unpack round-trip a fully populated player', () => {
  const player = samplePlayer();
  const restored = unpack(player.UID, pack(player, PLAYER_FIELDS), PLAYER_FIELDS);
  expect(restored).toEqual(player);
});

test('unpack preserves a real Expires date', () => {
  const player = { ...samplePlayer(), Expires: new Date(2035, 0, 24) };
  const restored = unpack(player.UID, pack(player, PLAYER_FIELDS), PLAYER_FIELDS);
  expect(restored.Expires).toBeInstanceOf(Date);
  expect(restored.Expires?.getMonth()).toBe(0);
});

test('unpack decodes against the field list a snapshot was written with', () => {
  const player = samplePlayer();
  const oldFields = PLAYER_FIELDS.filter((f) => f !== 'DistPer90');
  const restored = unpack(player.UID, pack(player, oldFields), oldFields);

  expect(restored.Name).toBe('Test Player');
  expect(restored.Club).toBe('Test FC');
  expect('DistPer90' in restored).toBe(false);
});

test('PLAYER_FIELDS excludes the key and the derived override', () => {
  expect(PLAYER_FIELDS).not.toContain('UID');
  expect(PLAYER_FIELDS).not.toContain('CustomPosition');
});

function snap(id: string, date: string | null, importedAt = 0): Snapshot {
  return { id, date, label: null, playerCount: 1, importedAt, fields: [] };
}

test('snapshots sort by date regardless of import order', () => {
  const backfilled = [snap('b', '2035-01-24', 1), snap('c', '2036-05-01', 2), snap('a', '2033-08-10', 3)];
  expect(sortSnapshots(backfilled).map((s) => s.id)).toEqual(['c', 'b', 'a']);
});

test('an undated snapshot sorts oldest and is never the newest', () => {
  const withUndated = [snap('u', null, 9), snap('d', '2033-08-10', 1)];
  expect(sortSnapshots(withUndated).map((s) => s.id)).toEqual(['d', 'u']);
  expect(newestSnapshot(withUndated)?.id).toBe('d');
});

test('an undated snapshot alone is the newest', () => {
  expect(newestSnapshot([snap('u', null)])?.id).toBe('u');
});

test('importedAt breaks a tie between equal dates', () => {
  const sameDay = [snap('first', '2035-01-24', 1), snap('second', '2035-01-24', 2)];
  expect(sortSnapshots(sameDay).map((s) => s.id)).toEqual(['second', 'first']);
});

test('derives the date from a team_date filename', () => {
  expect(deriveDateFromFilename('emmen_24_01_2035.html')).toBe('2035-01-24');
});

test('accepts hyphens and a club name containing digits', () => {
  expect(deriveDateFromFilename('fc-utrecht-2-24-01-2035.htm')).toBe('2035-01-24');
});

test('rejects a filename with no trailing date', () => {
  expect(deriveDateFromFilename('squad-export.html')).toBeNull();
});

test('rejects an impossible date', () => {
  expect(deriveDateFromFilename('emmen_32_01_2035.html')).toBeNull();
  expect(deriveDateFromFilename('emmen_24_13_2035.html')).toBeNull();
});

test('converts between display and iso', () => {
  expect(displayToIso('24/01/2035')).toBe('2035-01-24');
  expect(displayToIso('nonsense')).toBeNull();
  expect(isoToDisplay('2035-01-24')).toBe('24/01/2035');
  expect(isoToDisplay(null)).toBe('');
});

test('reports the columns an old export is missing', () => {
  const headers = REQUIRED_COLUMNS.filter((c) => c !== 'Pas %' && c !== 'xSv %');
  expect(findMissingColumns([...headers])).toEqual(['Pas %', 'xSv %']);
});

test('a complete header list reports nothing missing', () => {
  expect(findMissingColumns([...REQUIRED_COLUMNS, 'Extra Column'])).toEqual([]);
});

test('now resolves to the snapshot date itself', () => {
  const now = resolveHorizon('2035-01-24', 'now');
  expect(now?.getFullYear()).toBe(2035);
  expect(now?.getMonth()).toBe(0);
  expect(now?.getDate()).toBe(24);
});

test('season resolves to the following 30 June', () => {
  expect(resolveHorizon('2035-01-24', 'season')?.getFullYear()).toBe(2035);
  expect(resolveHorizon('2035-01-24', 'season')?.getMonth()).toBe(5);
  expect(resolveHorizon('2035-01-24', 'season')?.getDate()).toBe(30);
  expect(resolveHorizon('2035-08-10', 'season')?.getFullYear()).toBe(2036);
});

test('season resolves to the same 30 June when the snapshot is dated on it', () => {
  const boundary = resolveHorizon('2035-06-30', 'season');
  expect(boundary?.getFullYear()).toBe(2035);
  expect(boundary?.getMonth()).toBe(5);
  expect(boundary?.getDate()).toBe(30);
});

test('season rolls to next year the day after 30 June', () => {
  const dayAfter = resolveHorizon('2035-07-01', 'season');
  expect(dayAfter?.getFullYear()).toBe(2036);
  expect(dayAfter?.getMonth()).toBe(5);
  expect(dayAfter?.getDate()).toBe(30);
});

test('year offsets add whole years to the snapshot date', () => {
  expect(resolveHorizon('2035-01-24', '1y')?.getFullYear()).toBe(2036);
  expect(resolveHorizon('2035-01-24', '2y')?.getFullYear()).toBe(2037);
});

test('an undated snapshot or no preset gives no horizon', () => {
  expect(resolveHorizon(null, 'season')).toBeNull();
  expect(resolveHorizon('2035-01-24', null)).toBeNull();
});
