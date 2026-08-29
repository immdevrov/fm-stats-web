import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { db } from "../services/db";
import type { Player } from "../types/types";
import type { PlayerAnnotation, PlayerList } from "../types/annotations";

export type PlayerIdentity = Pick<Player, "Name" | "Club">;

interface PlayerNotesContextValue {
  annotations: Map<number, PlayerAnnotation>;
  lists: PlayerList[];
  isLoaded: boolean;
  isUnwanted: (uid: number) => boolean;
  toggleUnwanted: (uid: number, player?: PlayerIdentity) => Promise<void>;
  listsFor: (uid: number) => PlayerList[];
  addToList: (listId: string, uid: number, player?: PlayerIdentity) => Promise<void>;
  removeFromList: (listId: string, uid: number) => Promise<void>;
  createList: (name: string) => Promise<PlayerList>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  setPricing: (
    uid: number,
    values: { price?: number; wageDemand?: number; note?: string },
    player?: PlayerIdentity
  ) => Promise<void>;
}

const PlayerNotesContext = createContext<PlayerNotesContextValue | null>(null);

export function PlayerNotesProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<Map<number, PlayerAnnotation>>(new Map());
  const [lists, setLists] = useState<PlayerList[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([db.getAnnotations(), db.getLists()]).then(([loadedAnnotations, loadedLists]) => {
      setAnnotations(new Map(loadedAnnotations.map((a) => [a.uid, a])));
      setLists(loadedLists);
      setIsLoaded(true);
    });
  }, []);

  const refreshAnnotations = useCallback(async () => {
    const loaded = await db.getAnnotations();
    setAnnotations(new Map(loaded.map((a) => [a.uid, a])));
  }, []);

  const refreshLists = useCallback(async () => {
    setLists(await db.getLists());
  }, []);

  const isUnwanted = useCallback(
    (uid: number) => annotations.get(uid)?.unwanted === true,
    [annotations]
  );

  const toggleUnwanted = useCallback(
    async (uid: number, player?: PlayerIdentity) => {
      await db.setUnwanted(uid, !(annotations.get(uid)?.unwanted === true), player);
      await Promise.all([refreshAnnotations(), refreshLists()]);
    },
    [annotations, refreshAnnotations, refreshLists]
  );

  const listsFor = useCallback(
    (uid: number) => lists.filter((list) => list.uids.includes(uid)),
    [lists]
  );

  const addToList = useCallback(
    async (listId: string, uid: number, player?: PlayerIdentity) => {
      const list = lists.find((l) => l.id === listId);
      if (!list || list.uids.includes(uid)) return;
      await db.saveList({ ...list, uids: [...list.uids, uid] });
      await db.setAnnotation(uid, {}, player);
      await Promise.all([refreshLists(), refreshAnnotations()]);
    },
    [lists, refreshLists, refreshAnnotations]
  );

  const removeFromList = useCallback(
    async (listId: string, uid: number) => {
      const list = lists.find((l) => l.id === listId);
      if (!list) return;
      await db.saveList({ ...list, uids: list.uids.filter((id) => id !== uid) });
      await refreshLists();
    },
    [lists, refreshLists]
  );

  const createList = useCallback(
    async (name: string) => {
      const list: PlayerList = {
        id: crypto.randomUUID(),
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
      const list = lists.find((l) => l.id === id);
      if (!list) return;
      await db.saveList({ ...list, name });
      await refreshLists();
    },
    [lists, refreshLists]
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
      values: { price?: number; wageDemand?: number; note?: string },
      player?: PlayerIdentity
    ) => {
      await db.setAnnotation(uid, values, player);
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
        isUnwanted,
        toggleUnwanted,
        listsFor,
        addToList,
        removeFromList,
        createList,
        renameList,
        deleteList: removeList,
        setPricing,
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
