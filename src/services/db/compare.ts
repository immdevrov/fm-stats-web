import { getDB, wrapError } from './connection';

export async function getCompareList(): Promise<number[]> {
  try {
    const db = await getDB();
    const entry = await db.get('compareList', 'default');
    return entry?.uids ?? [];
  } catch {
    return [];
  }
}

export async function saveCompareList(uids: number[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('compareList', { id: 'default', uids });
  } catch (error) {
    throw wrapError('save compare list', error);
  }
}

export async function clearCompareList(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('compareList', 'default');
  } catch (error) {
    throw wrapError('clear compare list', error);
  }
}
