import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";

interface CompareContextValue {
  compareList: number[];
  addPlayer: (uid: number) => boolean;
  removePlayer: (uid: number) => void;
  clearAll: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

const MAX_PLAYERS = 3;

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareList, setCompareList] = useState<number[]>([]);
  const loaded = useRef(false);
  const userChanged = useRef(false);

  useEffect(() => {
    db.getCompareList().then((uids) => {
      // Missing from the active snapshot renders as missing; only a uid in no snapshot at all is stale.
      Promise.all(uids.map((uid) => db.getPlayerHistory(uid))).then((histories) => {
        const cleaned = uids.filter((_, index) => histories[index].length > 0);
        setCompareList((current) => (userChanged.current ? current : cleaned));
        loaded.current = true;
      });
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    db.saveCompareList(compareList);
  }, [compareList]);

  const addPlayer = useCallback((uid: number): boolean => {
    let added = false;
    userChanged.current = true;
    setCompareList((prev) => {
      if (prev.length >= MAX_PLAYERS || prev.includes(uid)) return prev;
      added = true;
      return [...prev, uid];
    });
    return added;
  }, []);

  const removePlayer = useCallback((uid: number) => {
    userChanged.current = true;
    setCompareList((prev) => prev.filter((id) => id !== uid));
  }, []);

  const clearAll = useCallback(() => {
    userChanged.current = true;
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
