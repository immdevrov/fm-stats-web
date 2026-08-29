import * as players from './players';
import * as rankings from './rankings';
import * as compare from './compare';

export const db = {
  ...players,
  ...rankings,
  ...compare,
};

export type { FmStatsDB } from './connection';
