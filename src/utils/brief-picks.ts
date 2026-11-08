import type { BriefPick, Grade } from "../types/briefs";

export function orderedShortlist(picks: BriefPick[] | undefined, listUids: number[]): BriefPick[] {
  const members = new Set(listUids);
  const seen = new Set<number>();
  const ordered: BriefPick[] = [];
  for (const pick of picks ?? []) {
    if (!members.has(pick.uid) || seen.has(pick.uid)) continue;
    seen.add(pick.uid);
    ordered.push({ ...pick });
  }
  for (const uid of listUids) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    ordered.push({ uid });
  }
  return ordered;
}

function withField<K extends "grade" | "verdict">(pick: BriefPick, key: K, value: BriefPick[K]): BriefPick {
  const copy = { ...pick };
  if (value === undefined) delete copy[key];
  else copy[key] = value;
  return copy;
}

function edit(
  picks: BriefPick[] | undefined,
  listUids: number[],
  uid: number,
  apply: (pick: BriefPick) => BriefPick
): BriefPick[] {
  return orderedShortlist(picks, listUids).map((pick) => (pick.uid === uid ? apply(pick) : pick));
}

export function setGrade(
  picks: BriefPick[] | undefined,
  listUids: number[],
  uid: number,
  grade: Grade | null
): BriefPick[] {
  return edit(picks, listUids, uid, (pick) => withField(pick, "grade", grade ?? undefined));
}

export function setVerdict(
  picks: BriefPick[] | undefined,
  listUids: number[],
  uid: number,
  text: string
): BriefPick[] {
  const verdict = text.trim();
  return edit(picks, listUids, uid, (pick) => withField(pick, "verdict", verdict || undefined));
}

export function moveTo(
  picks: BriefPick[] | undefined,
  listUids: number[],
  uid: number,
  toIndex: number
): BriefPick[] {
  const ordered = orderedShortlist(picks, listUids);
  const from = ordered.findIndex((pick) => pick.uid === uid);
  if (from === -1) return ordered;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved);
  return ordered;
}

export function prunePicks(picks: BriefPick[], memberUids: number[]): BriefPick[] | undefined {
  const members = new Set(memberUids);
  const kept = picks.filter((pick) => members.has(pick.uid));
  return kept.length === picks.length ? undefined : kept;
}
