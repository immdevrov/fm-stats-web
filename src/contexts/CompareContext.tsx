import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";
import { useOnTabReturn } from "../hooks/useOnTabReturn";

interface CompareContextValue {
  compareList: number[];
  addPlayer: (uid: number) => boolean;
  removePlayer: (uid: number) => void;
  clearAll: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

const MAX_PLAYERS = 3;

function sameUids(a: number[], b: number[]) {
  return a.length === b.length && a.every((uid, index) => uid === b[index]);
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareList, setCompareList] = useState<number[]>([]);
  const loaded = useRef(false);
  const changes = useRef(0);

  useEffect(() => {
    db
      .getCompareList()
      .then((uids) =>
        // Missing from the active snapshot renders as missing; only a uid in no snapshot at all is stale.
        Promise.all(uids.map((uid) => db.getPlayerHistory(uid))).then((histories) => {
          const cleaned = uids.filter((_, index) => histories[index].length > 0);
          setCompareList((current) => (changes.current > 0 ? current : cleaned));
          loaded.current = true;
        })
      )
      // Stays unloaded on a failure on purpose: persisting over a list we could not read would destroy it.
      .catch(() => undefined);
  }, []);

  useOnTabReturn(() => {
    if (!loaded.current) return;
    const start = changes.current;
    db.getCompareList()
      .then((uids) => {
        if (changes.current !== start) return;
        setCompareList((current) => (sameUids(current, uids) ? current : uids));
      })
      .catch(() => undefined);
  });

  useEffect(() => {
    if (!loaded.current) return;
    db.saveCompareList(compareList);
  }, [compareList]);

  const addPlayer = useCallback((uid: number): boolean => {
    let added = false;
    changes.current++;
    setCompareList((prev) => {
      if (prev.length >= MAX_PLAYERS || prev.includes(uid)) return prev;
      added = true;
      return [...prev, uid];
    });
    return added;
  }, []);

  const removePlayer = useCallback((uid: number) => {
    changes.current++;
    setCompareList((prev) => prev.filter((id) => id !== uid));
  }, []);

  const clearAll = useCallback(() => {
    changes.current++;
    setCompareList([]);
  }, []);

  return (
    <CompareContext.Provider value={{ compareList, addPlayer, removePlayer, clearAll }}>
      {children}
    </CompareContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
