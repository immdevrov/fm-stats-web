import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { useOnTabReturn } from "../hooks/useOnTabReturn";
import { generateId } from "../utils/ids";
import { moveTo, setGrade as applyGrade, setVerdict as applyVerdict } from "../utils/brief-picks";
import type { Brief, Grade, ScoutingFilters } from "../types/briefs";

interface BriefContextValue {
  briefs: Brief[];
  isLoaded: boolean;
  loadError: string | null;
  create: (name: string, filters: ScoutingFilters, listId?: string) => Brief;
  update: (id: string, filters: ScoutingFilters) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  setList: (briefId: string, listId: string | null) => void;
  unlinkList: (listId: string) => void;
  unlinkAll: () => void;
  setGrade: (briefId: string, listUids: number[], uid: number, grade: Grade | null) => void;
  setVerdict: (briefId: string, listUids: number[], uid: number, text: string) => void;
  movePick: (briefId: string, listUids: number[], uid: number, toIndex: number) => void;
}

type Change = (current: Brief[]) => Brief[];

function withoutList(brief: Brief): Brief {
  const copy = { ...brief };
  delete copy.listId;
  delete copy.picks;
  return copy;
}

const BriefContext = createContext<BriefContextValue | null>(null);

export function BriefProvider({ children }: { children: ReactNode }) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const changes = useRef(0);
  const loaded = useRef(false);
  const pending = useRef<Change[]>([]);

  useEffect(() => {
    db.getBriefs()
      .then((stored) => {
        if (loaded.current) return;
        loaded.current = true;
        const next = pending.current.reduce((acc, fn) => fn(acc), stored);
        pending.current = [];
        setBriefs(next);
        setLoadError(null);
        setIsLoaded(true);
      })
      .catch((error: unknown) => {
        if (loaded.current) return;
        setLoadError(error instanceof Error ? error.message : "Unknown error");
        toaster.create({
          id: "briefs-not-loaded",
          title: "Briefs Not Loaded",
          description: "Your briefs could not be read. Nothing was changed — reload the page to try again.",
          type: "error",
          duration: 6000,
        });
      });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    db.setBriefs(briefs).catch(() => {
      toaster.create({
        title: "Briefs Not Saved",
        description: "Your briefs could not be saved.",
        type: "error",
        duration: 3000,
      });
    });
  }, [isLoaded, briefs]);

  useOnTabReturn(() => {
    if (!isLoaded) return;
    const start = changes.current;
    db.getBriefs()
      .then((stored) => {
        if (changes.current !== start) return;
        setBriefs((current) =>
          JSON.stringify(current) === JSON.stringify(stored) ? current : stored
        );
      })
      .catch(() => undefined);
  });

  const change = useCallback((fn: Change) => {
    changes.current++;
    if (!loaded.current) pending.current.push(fn);
    setBriefs(fn);
  }, []);

  const create = useCallback(
    (name: string, filters: ScoutingFilters, listId?: string) => {
      const brief: Brief = { id: generateId("brief"), name: name.trim(), filters };
      if (listId) brief.listId = listId;
      change((current) => [...current, brief]);
      return brief;
    },
    [change]
  );

  const update = useCallback(
    (id: string, filters: ScoutingFilters) =>
      change((current) => current.map((a) => (a.id === id ? { ...a, filters } : a))),
    [change]
  );

  const rename = useCallback(
    (id: string, name: string) =>
      change((current) => current.map((a) => (a.id === id ? { ...a, name: name.trim() } : a))),
    [change]
  );

  const remove = useCallback(
    (id: string) => change((current) => current.filter((a) => a.id !== id)),
    [change]
  );

  const setList = useCallback(
    (briefId: string, listId: string | null) =>
      change((current) =>
        current.map((a) => {
          if (a.id !== briefId || a.listId === (listId ?? undefined)) return a;
          return listId ? { ...withoutList(a), listId } : withoutList(a);
        })
      ),
    [change]
  );

  const unlinkList = useCallback(
    (listId: string) =>
      change((current) => current.map((a) => (a.listId === listId ? withoutList(a) : a))),
    [change]
  );

  const unlinkAll = useCallback(() => change((current) => current.map(withoutList)), [change]);

  const editPicks = useCallback(
    (briefId: string, edit: (brief: Brief) => Brief["picks"]) =>
      change((current) => current.map((a) => (a.id === briefId ? { ...a, picks: edit(a) } : a))),
    [change]
  );

  const setGrade = useCallback(
    (briefId: string, listUids: number[], uid: number, grade: Grade | null) =>
      editPicks(briefId, (a) => applyGrade(a.picks, listUids, uid, grade)),
    [editPicks]
  );

  const setVerdict = useCallback(
    (briefId: string, listUids: number[], uid: number, text: string) =>
      editPicks(briefId, (a) => applyVerdict(a.picks, listUids, uid, text)),
    [editPicks]
  );

  const movePick = useCallback(
    (briefId: string, listUids: number[], uid: number, toIndex: number) =>
      editPicks(briefId, (a) => moveTo(a.picks, listUids, uid, toIndex)),
    [editPicks]
  );

  return (
    <BriefContext.Provider
      value={{
        briefs, isLoaded, loadError, create, update, rename, remove, setList, unlinkList, unlinkAll,
        setGrade, setVerdict, movePick,
      }}
    >
      {children}
    </BriefContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBriefs() {
  const ctx = useContext(BriefContext);
  if (!ctx) throw new Error("useBriefs must be used within BriefProvider");
  return ctx;
}
