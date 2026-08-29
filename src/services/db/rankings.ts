import { getDB, wrapError } from './connection';
import type { LeagueRanking } from '../../types/types';

export async function saveLeagueRankings(rankings: LeagueRanking[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('leagueRankings', 'readwrite');
    await tx.store.clear();
    await Promise.all(rankings.map((ranking) => tx.store.put(ranking)));
    await tx.done;
  } catch (error) {
    throw wrapError('save league rankings', error);
  }
}

export async function getLeagueRankings(): Promise<LeagueRanking[]> {
  try {
    const db = await getDB();
    const rankings = await db.getAll('leagueRankings');
    return rankings.sort((a, b) => a.rank - b.rank);
  } catch (error) {
    throw wrapError('get league rankings', error);
  }
}

export async function clearLeagueRankings(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('leagueRankings', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear league rankings', error);
  }
}
