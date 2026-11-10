import type { PlayerNote } from "../types/annotations";
import type { Brief } from "../types/briefs";

export function latestNote(notes: PlayerNote[] | undefined, briefId?: string): PlayerNote | null {
  if (!notes) return null;
  for (let i = notes.length - 1; i >= 0; i--) {
    if (briefId === undefined || notes[i].briefId === briefId) return notes[i];
  }
  return null;
}

export function noteBriefName(note: PlayerNote, briefs: Brief[]): string | null {
  if (!note.briefId) return null;
  return briefs.find((brief) => brief.id === note.briefId)?.name ?? note.briefName ?? null;
}

export function noteSummary(note: PlayerNote | null, briefs: Brief[]): string {
  if (!note) return "";
  const name = noteBriefName(note, briefs);
  return name ? `${name}: ${note.text}` : note.text;
}
