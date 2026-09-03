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
import { toaster } from "../components/ui/toaster";
import type { Snapshot } from "../types/snapshot";
import type { Player } from "../types/types";

interface SnapshotContextValue {
  snapshots: Snapshot[];
  activeId: string | null;
  active: Snapshot | null;
  isNewest: boolean;
  isLoaded: boolean;
  loadError: string | null;
  rosterError: string | null;
  setActive: (id: string) => void;
  refresh: () => Promise<void>;
  removeSnapshot: (id: string) => Promise<void>;
  editSnapshot: (id: string, patch: Partial<Pick<Snapshot, "date" | "label">>) => Promise<void>;
  roster: Player[] | null;
  rosterLoading: boolean;
  requestRoster: () => void;
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

const EMPTY_ROSTER: Player[] = [];

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roster, setRoster] = useState<Player[] | null>(null);
  const [rosterFor, setRosterFor] = useState<string | null>(null);
  const [rosterWanted, setRosterWanted] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, id] = await Promise.all([db.listSnapshots(), db.getActiveSnapshotId()]);
      setSnapshots(list);
      setActiveId(id);
      setLoadError(null);
    } catch (error) {
      setSnapshots([]);
      setActiveId(null);
      setLoadError(message(error));
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!rosterWanted || !isLoaded || !activeId || rosterFor === activeId) return;
    let cancelled = false;
    db.getAllPlayers()
      .then((players) => {
        if (!cancelled) {
          setRoster(players);
          setRosterFor(activeId);
          setRosterError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRoster(EMPTY_ROSTER);
          setRosterFor(activeId);
          setRosterError(message(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rosterWanted, isLoaded, activeId, rosterFor]);

  const effectiveRoster = !isLoaded
    ? null
    : activeId === null
      ? EMPTY_ROSTER
      : rosterFor === activeId
        ? roster
        : null;
  const rosterLoading = rosterWanted && (!isLoaded || (activeId !== null && rosterFor !== activeId));
  const effectiveRosterError = rosterFor === activeId ? rosterError : null;

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    db.setActiveSnapshotId(id).catch((error) => {
      toaster.create({
        title: "Date not remembered",
        description: `You are looking at this date now, but it could not be saved (${message(error)}). A reload will go back to the previous one.`,
        type: "warning",
        duration: 7000,
      });
    });
  }, []);

  const removeSnapshot = useCallback(
    async (id: string) => {
      await db.deleteSnapshot(id);
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
        loadError,
        rosterError: effectiveRosterError,
        setActive,
        refresh,
        removeSnapshot,
        editSnapshot,
        roster: effectiveRoster,
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
  const { requestRoster, roster, rosterLoading, rosterError, loadError } = ctx;

  useEffect(() => {
    requestRoster();
  }, [requestRoster]);

  return { players: roster, isLoading: rosterLoading, error: loadError ?? rosterError };
}
