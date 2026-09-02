import * as players from './players';
import * as rankings from './rankings';
import * as compare from './compare';
import * as annotations from './annotations';
import * as settings from './settings';
import * as snapshots from './snapshots';

export const db = {
  ...players,
  ...rankings,
  ...compare,
  ...annotations,
  ...settings,
  ...snapshots,
};

export type { FmStatsDB } from './connection';
