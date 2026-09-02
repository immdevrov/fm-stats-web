import type { Snapshot } from '../types/snapshot';

export function sortSnapshots(snapshots: Snapshot[]): Snapshot[] {
  return [...snapshots].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return b.date.localeCompare(a.date);
    }
    return b.importedAt - a.importedAt;
  });
}

export function newestSnapshot(snapshots: Snapshot[]): Snapshot | null {
  return sortSnapshots(snapshots)[0] ?? null;
}
