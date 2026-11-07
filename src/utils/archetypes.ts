import type { Archetype } from "../types/archetypes";

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
