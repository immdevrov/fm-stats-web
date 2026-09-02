import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { getFormation } from "../formations";
import { buildPlacementIndex, type PlacementIndex } from "../utils/planner";
import { MAX_DEPTH, type PlannedPlayer, type SquadPlan } from "../types/planner";

interface SquadPlanContextValue {
  plan: SquadPlan | null;
  isLoaded: boolean;
  placements: PlacementIndex;
  setFormation: (formationId: string) => void;
  setHorizon: (horizon: string | null) => void;
  place: (slotId: string, player: PlannedPlayer) => void;
  remove: (slotId: string, uid: number) => void;
  makeFirstChoice: (slotId: string, uid: number) => void;
  refreshSnapshots: (byUid: Map<number, { name: string; club: string }>) => void;
  removeMissing: (presentUids: Set<number>) => void;
  clearPlan: () => void;
}

const SquadPlanContext = createContext<SquadPlanContextValue | null>(null);

function emptyPlan(formationId: string, horizon: string | null): SquadPlan {
  const formation = getFormation(formationId);
  return {
    formationId,
    horizon,
    slots: (formation?.slots ?? []).map((slot) => ({ slotId: slot.id, players: [] })),
  };
}

export function SquadPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlanState] = useState<SquadPlan | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const userChanged = useRef(false);

  useEffect(() => {
    db.getSquadPlan().then((stored) => {
      setPlanState((current) => (userChanged.current ? current : stored));
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    db.setSquadPlan(plan).catch(() => {
      toaster.create({
        title: "Plan Not Saved",
        description: "Your squad plan could not be saved.",
        type: "error",
        duration: 3000,
      });
    });
  }, [isLoaded, plan]);

  const update = useCallback((fn: (current: SquadPlan) => SquadPlan) => {
    userChanged.current = true;
    setPlanState((current) => (current ? fn(current) : current));
  }, []);

  const mapSlot = useCallback(
    (slotId: string, fn: (players: PlannedPlayer[]) => PlannedPlayer[]) =>
      update((current) => ({
        ...current,
        slots: current.slots.map((slot) =>
          slot.slotId === slotId ? { ...slot, players: fn(slot.players) } : slot
        ),
      })),
    [update]
  );

  const setFormation = useCallback((formationId: string) => {
    userChanged.current = true;
    setPlanState((current) => emptyPlan(formationId, current?.horizon ?? null));
  }, []);

  const clearPlan = useCallback(() => {
    userChanged.current = true;
    setPlanState(null);
  }, []);

  const setHorizon = useCallback(
    (horizon: string | null) => update((current) => ({ ...current, horizon })),
    [update]
  );

  const place = useCallback(
    (slotId: string, player: PlannedPlayer) =>
      mapSlot(slotId, (players) =>
        players.length >= MAX_DEPTH || players.some((p) => p.uid === player.uid)
          ? players
          : [...players, player]
      ),
    [mapSlot]
  );

  const remove = useCallback(
    (slotId: string, uid: number) =>
      mapSlot(slotId, (players) => players.filter((p) => p.uid !== uid)),
    [mapSlot]
  );

  const makeFirstChoice = useCallback(
    (slotId: string, uid: number) =>
      mapSlot(slotId, (players) => {
        const promoted = players.find((p) => p.uid === uid);
        return promoted ? [promoted, ...players.filter((p) => p.uid !== uid)] : players;
      }),
    [mapSlot]
  );

  const refreshSnapshots = useCallback(
    (byUid: Map<number, { name: string; club: string }>) =>
      update((current) => {
        let changed = false;
        const slots = current.slots.map((slot) => {
          let slotChanged = false;
          const players = slot.players.map((player) => {
            const fresh = byUid.get(player.uid);
            if (fresh && (fresh.name !== player.name || fresh.club !== player.club)) {
              slotChanged = true;
              return { ...player, ...fresh };
            }
            return player;
          });
          if (!slotChanged) return slot;
          changed = true;
          return { ...slot, players };
        });
        return changed ? { ...current, slots } : current;
      }),
    [update]
  );

  const removeMissing = useCallback(
    (presentUids: Set<number>) =>
      update((current) => ({
        ...current,
        slots: current.slots.map((slot) => ({
          ...slot,
          players: slot.players.filter((player) => presentUids.has(player.uid)),
        })),
      })),
    [update]
  );

  const placements = useMemo(() => buildPlacementIndex(plan), [plan]);

  return (
    <SquadPlanContext.Provider
      value={{
        plan,
        isLoaded,
        placements,
        setFormation,
        setHorizon,
        place,
        remove,
        makeFirstChoice,
        refreshSnapshots,
        removeMissing,
        clearPlan,
      }}
    >
      {children}
    </SquadPlanContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSquadPlan() {
  const ctx = useContext(SquadPlanContext);
  if (!ctx) throw new Error("useSquadPlan must be used within SquadPlanProvider");
  return ctx;
}
