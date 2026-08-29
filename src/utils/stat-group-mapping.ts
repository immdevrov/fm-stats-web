export interface StatGroup {
  key: string;
  label: string;
  statKeys: string[];
}

const ROLE_STAT_GROUPS: Record<string, StatGroup[]> = {
  GK: [
    { key: "goalkeeper", label: "Goalkeeper", statKeys: ["saveRatio", "expectedSaveRatio", "savesHeldRatio", "goalsPrevented", "saveRatioOverExpected", "concededPer90", "savesPer90"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
    { key: "error", label: "Error", statKeys: ["mistakes"] },
  ],
  CD: [
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressuresSuccessful", "defensiveContributions"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
    { key: "possession", label: "Possession", statKeys: ["possessionWon", "possessionLost", "ballRetention"] },
    { key: "physical", label: "Physical", statKeys: ["height", "age"] },
    { key: "error", label: "Error", statKeys: ["mistakes"] },
  ],
  FB: [
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressuresSuccessful", "defensiveContributions"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
    { key: "possession", label: "Possession", statKeys: ["possessionWon", "possessionLost", "ballRetention"] },
    { key: "creative", label: "Creative", statKeys: ["xA"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles", "sprints", "crossRatio", "crossesSuccessful"] },
    { key: "physical", label: "Physical", statKeys: ["height", "age"] },
    { key: "error", label: "Error", statKeys: ["mistakes"] },
  ],
  DM: [
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressuresSuccessful", "defensiveContributions"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
    { key: "possession", label: "Possession", statKeys: ["possessionWon", "possessionLost", "ballRetention"] },
  ],
  CM: [
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses", "keyPasses"] },
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressuresSuccessful", "defensiveContributions"] },
    { key: "creative", label: "Creative", statKeys: ["chancesCreated"] },
    { key: "attacking", label: "Attacking", statKeys: ["npxG"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles", "sprints"] },
    { key: "possession", label: "Possession", statKeys: ["possessionWon", "possessionLost", "ballRetention"] },
  ],
  AM: [
    { key: "creative", label: "Creative", statKeys: ["xA", "chancesCreated"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses", "keyPasses"] },
    { key: "attacking", label: "Attacking", statKeys: ["npxG", "conversionRatio"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles"] },
    { key: "possession", label: "Possession", statKeys: ["possessionWon", "possessionLost", "ballRetention"] },
  ],
  W: [
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts"] },
    { key: "possession", label: "Possession", statKeys: ["possessionWon", "possessionLost", "ballRetention"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses", "keyPasses"] },
    { key: "defensive", label: "Defensive", statKeys: ["pressuresSuccessful"] },
    { key: "creative", label: "Creative", statKeys: ["xA", "chancesCreated"] },
    { key: "attacking", label: "Attacking", statKeys: ["npxG", "conversionRatio"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles", "sprints", "crossRatio", "crossesSuccessful"] },
  ],
  ST: [
    { key: "attacking", label: "Attacking", statKeys: ["goals", "npxG", "xGOverperformance", "shots", "conversionRatio"] },
    { key: "creative", label: "Creative", statKeys: ["xA", "chancesCreated"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressuresSuccessful"] },
    { key: "passing", label: "Passing", statKeys: ["keyPasses"] },
    { key: "possession", label: "Possession", statKeys: ["possessionWon", "ballRetention"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles"] },
  ],
};

export function getStatGroupsForRole(roleKey: string): StatGroup[] {
  return ROLE_STAT_GROUPS[roleKey] ?? [];
}
