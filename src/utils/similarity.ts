import { getPercentileFromSorted, getColumn } from "./utils";

export interface SimilarPlayer {
  uid: number;
  name: string;
  club: string;
  distance: number;
  percentiles: Record<string, number>;
}

export function calculateEuclideanDistance(
  a: Record<string, number>,
  b: Record<string, number>,
  keys: string[]
): number {
  let sumSquares = 0;
  for (const key of keys) {
    const diff = (a[key] ?? 0) - (b[key] ?? 0);
    sumSquares += diff * diff;
  }
  return Math.sqrt(sumSquares);
}

export function findSimilarPlayers(
  targetUid: number,
  targetPercentiles: Record<string, number>,
  cohort: Record<string, unknown>[],
  statKeys: string[],
  limit: number = 5
): SimilarPlayer[] {
  // Pre-sort cohort values once per stat key
  const sortedCohortValues: Record<string, number[]> = {};
  for (const key of statKeys) {
    const values = getColumn(cohort, key) as number[];
    sortedCohortValues[key] = [...values].sort((a, b) => a - b);
  }

  const results: SimilarPlayer[] = [];

  for (const roleInstance of cohort) {
    const uid = roleInstance["uid"] as number;
    if (uid === targetUid) continue;

    const percentiles: Record<string, number> = {};
    for (const key of statKeys) {
      const value = roleInstance[key] as number;
      try {
        percentiles[key] = getPercentileFromSorted(value ?? 0, sortedCohortValues[key]);
      } catch {
        percentiles[key] = 0;
      }
    }

    const distance = calculateEuclideanDistance(
      targetPercentiles,
      percentiles,
      statKeys
    );

    results.push({
      uid,
      name: roleInstance["name"] as string,
      club: roleInstance["club"] as string,
      distance,
      percentiles,
    });
  }

  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, limit);
}
