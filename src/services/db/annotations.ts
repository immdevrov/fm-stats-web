import { getDB, wrapError } from './connection';
import type { Player } from '../../types/types';
import type { PlayerAnnotation, PlayerList, PlayerNote, TransferMark } from '../../types/annotations';
import { generateId } from '../../utils/ids';

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
    const tx = db.transaction('playerAnnotations', 'readwrite');
    const existing = await tx.store.get(uid);
    await tx.store.put({
      ...existing,
      ...patch,
      uid,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });
    await tx.done;
  } catch (error) {
    throw wrapError('set annotation', error);
  }
}

export type NewNote = Omit<PlayerNote, 'id'>;

export async function addNote(uid: number, note: NewNote, player?: PlayerIdentity): Promise<void> {
  const text = note.text.trim();
  if (!text) return;
  try {
    const db = await getDB();
    const tx = db.transaction('playerAnnotations', 'readwrite');
    const existing = await tx.store.get(uid);
    await tx.store.put({
      ...existing,
      uid,
      notes: [...(existing?.notes ?? []), { ...note, id: generateId('note'), text }],
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });
    await tx.done;
  } catch (error) {
    throw wrapError('add note', error);
  }
}

async function editNotes(
  uid: number,
  action: string,
  edit: (notes: PlayerNote[]) => PlayerNote[] | null
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerAnnotations', 'readwrite');
    const existing = await tx.store.get(uid);
    const notes = existing?.notes ? edit(existing.notes) : null;
    if (existing && notes) await tx.store.put({ ...existing, notes });
    await tx.done;
  } catch (error) {
    throw wrapError(action, error);
  }
}

export function updateNote(uid: number, noteId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return Promise.resolve();
  return editNotes(uid, 'update note', (notes) =>
    notes.some((n) => n.id === noteId)
      ? notes.map((n) => (n.id === noteId ? { ...n, text: trimmed } : n))
      : null
  );
}

export function deleteNote(uid: number, noteId: string): Promise<void> {
  return editNotes(uid, 'delete note', (notes) =>
    notes.some((n) => n.id === noteId) ? notes.filter((n) => n.id !== noteId) : null
  );
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

export async function clearListsAndAnnotations(alsoDropPositions = false): Promise<void> {
  const preserved = alsoDropPositions
    ? []
    : (await getAnnotations()).filter((a) => a.customPosition);

  await clearAllLists();
  await clearAllAnnotations();

  for (const annotation of preserved) {
    const player = annotation.lastKnownName
      ? { Name: annotation.lastKnownName, Club: annotation.lastKnownClub ?? '' }
      : undefined;
    await setAnnotation(annotation.uid, { customPosition: annotation.customPosition }, player);
  }
}

export async function setTransfer(
  uid: number,
  transfer: TransferMark | null,
  player?: PlayerIdentity
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerAnnotations', 'readwrite');
    const existing = await tx.store.get(uid);
    await tx.store.put({
      ...existing,
      uid,
      transfer: transfer ?? undefined,
      unwanted: transfer ? false : existing?.unwanted,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });
    await tx.done;
  } catch (error) {
    throw wrapError('set transfer', error);
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
      transfer: unwanted ? undefined : existing?.transfer,
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
