import { getDB, wrapError } from './connection';

const MY_CLUB = 'myClub';

export async function getMyClub(): Promise<string | null> {
  try {
    const db = await getDB();
    const entry = await db.get('settings', MY_CLUB);
    return (entry?.value as string) ?? null;
  } catch {
    return null;
  }
}

export async function setMyClub(club: string | null): Promise<void> {
  try {
    const db = await getDB();
    if (club === null) {
      await db.delete('settings', MY_CLUB);
      return;
    }
    await db.put('settings', { key: MY_CLUB, value: club });
  } catch (error) {
    throw wrapError('save my team', error);
  }
}
