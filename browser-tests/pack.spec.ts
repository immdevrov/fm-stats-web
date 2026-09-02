import { test, expect } from '@playwright/test';
import { parseCustomDate } from '../src/utils/utils';
import { PLAYER_FIELDS, pack, unpack } from '../src/services/db/pack';
import type { Player } from '../src/types/types';

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
