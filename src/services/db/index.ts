import * as players from './players';
import * as rankings from './rankings';
import * as compare from './compare';
import * as annotations from './annotations';

export const db = {
  ...players,
  ...rankings,
  ...compare,
  ...annotations,
};

export type { FmStatsDB } from './connection';
