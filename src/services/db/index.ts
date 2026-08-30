import * as players from './players';
import * as rankings from './rankings';
import * as compare from './compare';
import * as annotations from './annotations';
import * as settings from './settings';

export const db = {
  ...players,
  ...rankings,
  ...compare,
  ...annotations,
  ...settings,
};

export type { FmStatsDB } from './connection';
