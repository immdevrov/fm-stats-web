import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { useOnTabReturn } from "../hooks/useOnTabReturn";
import { generateId } from "../utils/ids";
import type { Archetype, ScoutingFilters } from "../types/archetypes";

interface ArchetypeContextValue {
  archetypes: Archetype[];
  isLoaded: boolean;
  create: (name: string, filters: ScoutingFilters) => Archetype;
  update: (id: string, filters: ScoutingFilters) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

const ArchetypeContext = createContext<ArchetypeContextValue | null>(null);

export function ArchetypeProvider({ children }: { children: ReactNode }) {
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const changes = useRef(0);

  useEffect(() => {
    db.getArchetypes().then((stored) => {
      setArchetypes((current) => (changes.current > 0 ? current : stored));
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

  const change = useCallback((fn: (current: Archetype[]) => Archetype[]) => {
    changes.current++;
    setArchetypes(fn);
  }, []);

  const create = useCallback(
    (name: string, filters: ScoutingFilters) => {
      const archetype: Archetype = { id: generateId("archetype"), name: name.trim(), filters };
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

  return (
    <ArchetypeContext.Provider value={{ archetypes, isLoaded, create, update, rename, remove }}>
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
