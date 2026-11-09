export interface Dominance {
  comparable: boolean;
  beats: Set<number>;
  beatenBy: Set<number>;
}

type Row = { uid: number } & Record<string, unknown>;

function values(row: Row, keys: string[]): number[] | null {
  const out: number[] = [];
  for (const key of keys) {
    const value = row[key];
    if (typeof value !== "number") return null;
    out.push(value);
  }
  return out;
}

function compare(a: number[], b: number[]): number {
  let better = false;
  let worse = false;
  a.forEach((value, i) => {
    if (value > b[i]) better = true;
    if (value < b[i]) worse = true;
  });
  if (better === worse) return 0;
  return better ? 1 : -1;
}

export function dominance(rows: Row[], keys: string[], focusUid: number): Dominance {
  const beats = new Set<number>();
  const beatenBy = new Set<number>();
  const focus = rows.find((row) => row.uid === focusUid);
  const own = focus && keys.length > 0 ? values(focus, keys) : null;
  if (!own) return { comparable: false, beats, beatenBy };

  for (const row of rows) {
    if (row.uid === focusUid) continue;
    const other = values(row, keys);
    if (!other) continue;
    const result = compare(own, other);
    if (result > 0) beats.add(row.uid);
    if (result < 0) beatenBy.add(row.uid);
  }
  return { comparable: true, beats, beatenBy };
}
