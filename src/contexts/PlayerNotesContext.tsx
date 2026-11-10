import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { db } from "../services/db";
import { useSnapshots } from "./SnapshotContext";
import { newestSnapshot } from "../utils/snapshot-order";
import { useOnTabReturn } from "../hooks/useOnTabReturn";
import { generateId } from "../utils/ids";
import type { Player } from "../types/types";
import type { PlayerAnnotation, PlayerList, TransferMark } from "../types/annotations";

export type PlayerIdentity = Pick<Player, "Name" | "Club">;

interface PlayerNotesContextValue {
  annotations: Map<number, PlayerAnnotation>;
  lists: PlayerList[];
  isLoaded: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  isUnwanted: (uid: number) => boolean;
  toggleUnwanted: (uid: number, player?: PlayerIdentity) => Promise<void>;
  setUnwanted: (uid: number, unwanted: boolean, player?: PlayerIdentity) => Promise<void>;
  onListsChanged: (listener: (lists: PlayerList[]) => void) => () => void;
  transferOf: (uid: number) => TransferMark | undefined;
  setTransfer: (uid: number, transfer: TransferMark | null, player?: PlayerIdentity) => Promise<void>;
  listsFor: (uid: number) => PlayerList[];
  addToList: (listId: string, uid: number, player?: PlayerIdentity) => Promise<void>;
  removeFromList: (listId: string, uid: number) => Promise<void>;
  createList: (name: string) => Promise<PlayerList>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  setPricing: (
    uid: number,
    values: { price?: number; wageDemand?: number },
    player?: PlayerIdentity
  ) => Promise<void>;
  addNote: (
    uid: number,
    note: { text: string; briefId?: string; briefName?: string },
    player?: PlayerIdentity
  ) => Promise<void>;
  updateNote: (uid: number, noteId: string, text: string) => Promise<void>;
  deleteNote: (uid: number, noteId: string) => Promise<void>;
}

const PlayerNotesContext = createContext<PlayerNotesContextValue | null>(null);

export function PlayerNotesProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<Map<number, PlayerAnnotation>>(new Map());
  const [lists, setLists] = useState<PlayerList[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const listeners = useRef(new Set<(lists: PlayerList[]) => void>());

  useEffect(() => {
    async function loadNotes() {
      try {
        const [loadedAnnotations, loadedLists] = await Promise.all([
          db.getAnnotations(),
          db.getLists(),
        ]);
        setAnnotations(new Map(loadedAnnotations.map((a) => [a.uid, a])));
        setLists(loadedLists);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load player notes");
      } finally {
        setIsLoaded(true);
      }
    }

    loadNotes();
  }, []);

  const refreshAnnotations = useCallback(async () => {
    const loaded = await db.getAnnotations();
    setAnnotations(new Map(loaded.map((a) => [a.uid, a])));
  }, []);

  const refreshLists = useCallback(async () => {
    const read = await db.getLists();
    setLists(read);
    return read;
  }, []);

  const onListsChanged = useCallback((listener: (lists: PlayerList[]) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const notify = useCallback((read: PlayerList[]) => {
    listeners.current.forEach((listener) => listener(read));
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshAnnotations(), refreshLists()]);
  }, [refreshAnnotations, refreshLists]);

  useOnTabReturn(() => {
    if (isLoaded && !loadError) refresh().catch(() => undefined);
  });

  const isUnwanted = useCallback(
    (uid: number) => annotations.get(uid)?.unwanted === true,
    [annotations]
  );

  const setUnwanted = useCallback(
    async (uid: number, unwanted: boolean, player?: PlayerIdentity) => {
      await db.setUnwanted(uid, unwanted, player);
      const [, read] = await Promise.all([refreshAnnotations(), refreshLists()]);
      notify(read);
    },
    [refreshAnnotations, refreshLists, notify]
  );

  const toggleUnwanted = useCallback(
    (uid: number, player?: PlayerIdentity) =>
      setUnwanted(uid, !(annotations.get(uid)?.unwanted === true), player),
    [annotations, setUnwanted]
  );

  const transferOf = useCallback(
    (uid: number) => annotations.get(uid)?.transfer,
    [annotations]
  );

  const setTransfer = useCallback(
    async (uid: number, transfer: TransferMark | null, player?: PlayerIdentity) => {
      await db.setTransfer(uid, transfer, player);
      await refreshAnnotations();
    },
    [refreshAnnotations]
  );

  const listsFor = useCallback(
    (uid: number) => lists.filter((list) => list.uids.includes(uid)),
    [lists]
  );

  const addToList = useCallback(
    async (listId: string, uid: number, player?: PlayerIdentity) => {
      const stored = await db.getLists();
      const list = stored.find((l) => l.id === listId);
      if (!list || list.uids.includes(uid)) return;
      await db.saveList({ ...list, uids: [...list.uids, uid] });
      await db.setAnnotation(uid, {}, player);
      await Promise.all([refreshLists(), refreshAnnotations()]);
    },
    [refreshLists, refreshAnnotations]
  );

  const removeFromList = useCallback(
    async (listId: string, uid: number) => {
      const stored = await db.getLists();
      const list = stored.find((l) => l.id === listId);
      if (!list) return;
      await db.saveList({ ...list, uids: list.uids.filter((id) => id !== uid) });
      notify(await refreshLists());
    },
    [refreshLists, notify]
  );

  const createList = useCallback(
    async (name: string) => {
      const list: PlayerList = {
        id: generateId("list"),
        name,
        order: lists.length,
        uids: [],
        createdAt: new Date(),
      };
      await db.saveList(list);
      await refreshLists();
      return list;
    },
    [lists, refreshLists]
  );

  const renameList = useCallback(
    async (id: string, name: string) => {
      const stored = await db.getLists();
      const list = stored.find((l) => l.id === id);
      if (!list) return;
      await db.saveList({ ...list, name });
      await refreshLists();
    },
    [refreshLists]
  );

  const removeList = useCallback(
    async (id: string) => {
      await db.deleteList(id);
      await refreshLists();
    },
    [refreshLists]
  );

  const setPricing = useCallback(
    async (
      uid: number,
      values: { price?: number; wageDemand?: number },
      player?: PlayerIdentity
    ) => {
      await db.setAnnotation(uid, values, player);
      await refreshAnnotations();
    },
    [refreshAnnotations]
  );

  const { snapshots } = useSnapshots();
  const noteDate = newestSnapshot(snapshots)?.date ?? null;

  const addNote = useCallback(
    async (
      uid: number,
      note: { text: string; briefId?: string; briefName?: string },
      player?: PlayerIdentity
    ) => {
      await db.addNote(uid, { ...note, date: noteDate }, player);
      await refreshAnnotations();
    },
    [noteDate, refreshAnnotations]
  );

  const updateNote = useCallback(
    async (uid: number, noteId: string, text: string) => {
      await db.updateNote(uid, noteId, text);
      await refreshAnnotations();
    },
    [refreshAnnotations]
  );

  const deleteNote = useCallback(
    async (uid: number, noteId: string) => {
      await db.deleteNote(uid, noteId);
      await refreshAnnotations();
    },
    [refreshAnnotations]
  );

  return (
    <PlayerNotesContext.Provider
      value={{
        annotations,
        lists,
        isLoaded,
        loadError,
        refresh,
        isUnwanted,
        toggleUnwanted,
        setUnwanted,
        onListsChanged,
        transferOf,
        setTransfer,
        listsFor,
        addToList,
        removeFromList,
        createList,
        renameList,
        deleteList: removeList,
        setPricing,
        addNote,
        updateNote,
        deleteNote,
      }}
    >
      {children}
    </PlayerNotesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayerNotes() {
  const ctx = useContext(PlayerNotesContext);
  if (!ctx) throw new Error("usePlayerNotes must be used within PlayerNotesProvider");
  return ctx;
}
