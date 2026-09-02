import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";
import { useRoster } from "./SnapshotContext";

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
  const { players } = useRoster();

  useEffect(() => {
    if (players === null) return;
    db.getCompareList().then((uids) => {
      const validUids = new Set(players.map((p) => p.UID));
      const cleaned = uids.filter((uid) => validUids.has(uid));
      setCompareList(cleaned);
      loaded.current = true;
    });
  }, [players]);

  useEffect(() => {
    if (!loaded.current) return;
    db.saveCompareList(compareList);
  }, [compareList]);

  const addPlayer = useCallback((uid: number): boolean => {
    let added = false;
    setCompareList((prev) => {
      if (prev.length >= MAX_PLAYERS || prev.includes(uid)) return prev;
      added = true;
      return [...prev, uid];
    });
    return added;
  }, []);

  const removePlayer = useCallback((uid: number) => {
    setCompareList((prev) => prev.filter((id) => id !== uid));
  }, []);

  const clearAll = useCallback(() => {
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
