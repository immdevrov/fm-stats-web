import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { db } from "../services/db";
import { newestSnapshot } from "../utils/snapshot-order";
import type { Snapshot } from "../types/snapshot";
import type { Player } from "../types/types";

interface SnapshotContextValue {
  snapshots: Snapshot[];
  activeId: string | null;
  active: Snapshot | null;
  isNewest: boolean;
  isLoaded: boolean;
  setActive: (id: string) => void;
  refresh: () => Promise<void>;
  removeSnapshot: (id: string) => Promise<void>;
  editSnapshot: (id: string, patch: Partial<Pick<Snapshot, "date" | "label">>) => Promise<void>;
  roster: Player[] | null;
  rosterLoading: boolean;
  requestRoster: () => void;
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [roster, setRoster] = useState<Player[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterWanted, setRosterWanted] = useState(false);

  const refresh = useCallback(async () => {
    const [list, id] = await Promise.all([db.listSnapshots(), db.getActiveSnapshotId()]);
    setSnapshots(list);
    setActiveId(id);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!rosterWanted || !isLoaded) return;
    if (!activeId) {
      setRoster([]);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    db.getAllPlayers()
      .then((players) => {
        if (!cancelled) setRoster(players);
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rosterWanted, isLoaded, activeId]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    setRoster(null);
    db.setActiveSnapshotId(id);
  }, []);

  const removeSnapshot = useCallback(
    async (id: string) => {
      await db.deleteSnapshot(id);
      setRoster(null);
      await refresh();
    },
    [refresh]
  );

  const editSnapshot = useCallback(
    async (id: string, patch: Partial<Pick<Snapshot, "date" | "label">>) => {
      await db.updateSnapshot(id, patch);
      await refresh();
    },
    [refresh]
  );

  const requestRoster = useCallback(() => setRosterWanted(true), []);

  const active = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === activeId) ?? null,
    [snapshots, activeId]
  );

  const isNewest = useMemo(
    () => snapshots.length === 0 || newestSnapshot(snapshots)?.id === activeId,
    [snapshots, activeId]
  );

  return (
    <SnapshotContext.Provider
      value={{
        snapshots,
        activeId,
        active,
        isNewest,
        isLoaded,
        setActive,
        refresh,
        removeSnapshot,
        editSnapshot,
        roster,
        rosterLoading,
        requestRoster,
      }}
    >
      {children}
    </SnapshotContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSnapshots() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error("useSnapshots must be used within SnapshotProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRoster() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error("useRoster must be used within SnapshotProvider");
  const { requestRoster, roster, rosterLoading } = ctx;

  useEffect(() => {
    requestRoster();
  }, [requestRoster]);

  return { players: roster, isLoading: rosterLoading };
}
