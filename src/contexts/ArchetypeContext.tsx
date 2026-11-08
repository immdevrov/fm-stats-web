import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { useOnTabReturn } from "../hooks/useOnTabReturn";
import { generateId } from "../utils/ids";
import type { Archetype, ScoutingFilters } from "../types/archetypes";

interface ArchetypeContextValue {
  archetypes: Archetype[];
  isLoaded: boolean;
  create: (name: string, filters: ScoutingFilters, listId?: string) => Archetype;
  update: (id: string, filters: ScoutingFilters) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  setList: (archetypeId: string, listId: string | null) => void;
  unlinkList: (listId: string) => void;
  unlinkAll: () => void;
}

type Change = (current: Archetype[]) => Archetype[];

function withoutList(archetype: Archetype): Archetype {
  const copy = { ...archetype };
  delete copy.listId;
  return copy;
}

const ArchetypeContext = createContext<ArchetypeContextValue | null>(null);

export function ArchetypeProvider({ children }: { children: ReactNode }) {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const changes = useRef(0);
  const loaded = useRef(false);
  const pending = useRef<Change[]>([]);

  useEffect(() => {
    db.getArchetypes().then((stored) => {
      if (loaded.current) return;
      loaded.current = true;
      const next = pending.current.reduce((acc, fn) => fn(acc), stored);
      pending.current = [];
      setArchetypes(next);
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    db.setArchetypes(archetypes).catch(() => {
      toaster.create({
        title: "Archetypes Not Saved",
        description: "Your archetypes could not be saved.",
        type: "error",
        duration: 3000,
      });
    });
  }, [isLoaded, archetypes]);

  useOnTabReturn(() => {
    if (!isLoaded) return;
    const start = changes.current;
    db.getArchetypes()
      .then((stored) => {
        if (changes.current !== start) return;
        setArchetypes((current) =>
          JSON.stringify(current) === JSON.stringify(stored) ? current : stored
        );
      })
      .catch(() => undefined);
  });

  const change = useCallback((fn: Change) => {
    changes.current++;
    if (!loaded.current) pending.current.push(fn);
    setArchetypes(fn);
  }, []);

  const create = useCallback(
    (name: string, filters: ScoutingFilters, listId?: string) => {
      const archetype: Archetype = { id: generateId("archetype"), name: name.trim(), filters };
      if (listId) archetype.listId = listId;
      change((current) => [...current, archetype]);
      return archetype;
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
    (archetypeId: string, listId: string | null) =>
      change((current) =>
        current.map((a) => (a.id !== archetypeId ? a : listId ? { ...a, listId } : withoutList(a)))
      ),
    [change]
  );

  const unlinkList = useCallback(
    (listId: string) =>
      change((current) => current.map((a) => (a.listId === listId ? withoutList(a) : a))),
    [change]
  );

  const unlinkAll = useCallback(() => change((current) => current.map(withoutList)), [change]);

  return (
    <ArchetypeContext.Provider
      value={{ archetypes, isLoaded, create, update, rename, remove, setList, unlinkList, unlinkAll }}
    >
      {children}
    </ArchetypeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useArchetypes() {
  const ctx = useContext(ArchetypeContext);
  if (!ctx) throw new Error("useArchetypes must be used within ArchetypeProvider");
  return ctx;
}
