import { ROLE_CONFIG } from "../roles";
import type { Brief, Side } from "../types/briefs";
import type { PlayerList } from "../types/annotations";

export function roleLabel(roleKey: string, side: Side): string {
  const name = ROLE_CONFIG.find((rc) => rc.key === roleKey)?.name ?? roleKey;
  return side === "both" ? name : `${name}, ${side}`;
}

export function linkedListOf(
  brief: Brief | null,
  lists: PlayerList[],
  notesReady: boolean
): PlayerList | null {
  if (!notesReady || !brief?.listId) return null;
  return lists.find((list) => list.id === brief.listId) ?? null;
}

export function validateBriefName(
  name: string,
  briefs: Brief[],
  exceptId?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name can't be empty.";
  const lower = trimmed.toLowerCase();
  const taken = briefs.some((a) => a.id !== exceptId && a.name.toLowerCase() === lower);
  return taken ? `A brief named “${trimmed}” already exists.` : null;
}
