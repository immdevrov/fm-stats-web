import { getDB, wrapError } from './connection';
import type { Player } from '../../types/types';
import type { PlayerAnnotation, PlayerList } from '../../types/annotations';

type PlayerIdentity = Pick<Player, 'Name' | 'Club'>;

export async function getAnnotations(): Promise<PlayerAnnotation[]> {
  try {
    const db = await getDB();
    return await db.getAll('playerAnnotations');
  } catch (error) {
    throw wrapError('get annotations', error);
  }
}

export async function getAnnotation(uid: number): Promise<PlayerAnnotation | undefined> {
  try {
    const db = await getDB();
    return await db.get('playerAnnotations', uid);
  } catch (error) {
    throw wrapError('get annotation', error);
  }
}

export async function setAnnotation(
  uid: number,
  patch: Partial<PlayerAnnotation>,
  player?: PlayerIdentity
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('playerAnnotations', uid);
    const merged: PlayerAnnotation = {
      ...existing,
      ...patch,
      uid,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    };
    await db.put('playerAnnotations', merged);
  } catch (error) {
    throw wrapError('set annotation', error);
  }
}

export async function clearAllAnnotations(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerAnnotations', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear annotations', error);
  }
}

export async function getLists(): Promise<PlayerList[]> {
  try {
    const db = await getDB();
    const lists = await db.getAll('playerLists');
    return lists.sort((a, b) => a.order - b.order);
  } catch (error) {
    throw wrapError('get lists', error);
  }
}

export async function saveList(list: PlayerList): Promise<void> {
  try {
    const db = await getDB();
    await db.put('playerLists', list);
  } catch (error) {
    throw wrapError('save list', error);
  }
}

export async function deleteList(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('playerLists', id);
  } catch (error) {
    throw wrapError('delete list', error);
  }
}

export async function clearAllLists(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerLists', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear lists', error);
  }
}

export async function setUnwanted(
  uid: number,
  unwanted: boolean,
  player?: PlayerIdentity
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(['playerAnnotations', 'playerLists'], 'readwrite');
    const annotationStore = tx.objectStore('playerAnnotations');
    const listStore = tx.objectStore('playerLists');

    const existing = await annotationStore.get(uid);
    await annotationStore.put({
      ...existing,
      uid,
      unwanted,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });

    if (unwanted) {
      const lists = await listStore.getAll();
      await Promise.all(
        lists
          .filter((list) => list.uids.includes(uid))
          .map((list) =>
            listStore.put({ ...list, uids: list.uids.filter((id) => id !== uid) })
          )
      );
    }

    await tx.done;
  } catch (error) {
    throw wrapError('set unwanted', error);
  }
}
