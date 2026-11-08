import type { Archetype } from "../types/archetypes";
import type { PlayerList } from "../types/annotations";

export function linkedListOf(
  archetype: Archetype | null,
  lists: PlayerList[],
  notesReady: boolean
): PlayerList | null {
  if (!notesReady || !archetype?.listId) return null;
  return lists.find((list) => list.id === archetype.listId) ?? null;
}

export function validateArchetypeName(
  name: string,
  archetypes: Archetype[],
  exceptId?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name can't be empty.";
  const lower = trimmed.toLowerCase();
  const taken = archetypes.some((a) => a.id !== exceptId && a.name.toLowerCase() === lower);
  return taken ? `An archetype named “${trimmed}” already exists.` : null;
}
