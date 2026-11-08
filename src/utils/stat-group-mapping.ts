export interface StatGroup {
  key: string;
  label: string;
  statKeys: string[];
  description: string;
}

const GROUP_DESCRIPTIONS = {
  goalkeeper: "Stopping shots and keeping goals out.",
  defensive: "Winning the ball back and stopping attacks.",
  aerial: "Competing for the ball in the air.",
  passing: "Moving the ball on with passes.",
  creative: "Setting up chances for others.",
  attacking: "Getting into scoring positions and finishing.",
  crossing: "Delivering the ball from wide areas.",
  movement: "Moving with the ball and without it.",
  error: "Mistakes that lead to goals; lower is better.",
} as const;

type GroupDefinition = Omit<StatGroup, "key" | "description"> & { key: keyof typeof GROUP_DESCRIPTIONS };

const ROLE_STAT_GROUPS: Record<string, GroupDefinition[]> = {
  GK: [
    { key: "goalkeeper", label: "Goalkeeper", statKeys: ["saveRatio", "expectedSaveRatio", "savesHeldRatio", "goalsPrevented", "saveRatioOverExpected", "concededPer90", "savesPer90"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
    { key: "error", label: "Error", statKeys: ["mistakes"] },
  ],
  CD: [
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressureRatio", "pressuresAttempted", "defensiveContributions"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
    { key: "error", label: "Error", statKeys: ["mistakes"] },
  ],
  FB: [
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressureRatio", "pressuresAttempted", "defensiveContributions"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
    { key: "creative", label: "Creative", statKeys: ["xA"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles", "sprints"] },
    { key: "crossing", label: "Crossing", statKeys: ["crossRatio", "crossesSuccessful"] },
    { key: "error", label: "Error", statKeys: ["mistakes"] },
  ],
  DM: [
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressureRatio", "pressuresAttempted", "defensiveContributions"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses"] },
  ],
  CM: [
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses", "keyPasses"] },
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressureRatio", "pressuresAttempted", "defensiveContributions"] },
    { key: "creative", label: "Creative", statKeys: ["chancesCreated"] },
    { key: "attacking", label: "Attacking", statKeys: ["npxG"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles", "sprints"] },
  ],
  AM: [
    { key: "creative", label: "Creative", statKeys: ["xA", "chancesCreated"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses", "keyPasses"] },
    { key: "attacking", label: "Attacking", statKeys: ["npxG", "conversionRatio"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles"] },
  ],
  W: [
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts"] },
    { key: "passing", label: "Passing", statKeys: ["passRatio", "progressivePasses", "keyPasses"] },
    { key: "defensive", label: "Defensive", statKeys: ["pressureRatio", "pressuresAttempted"] },
    { key: "creative", label: "Creative", statKeys: ["xA", "chancesCreated"] },
    { key: "attacking", label: "Attacking", statKeys: ["npxG", "conversionRatio"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles", "sprints"] },
    { key: "crossing", label: "Crossing", statKeys: ["crossRatio", "crossesSuccessful"] },
  ],
  ST: [
    { key: "attacking", label: "Attacking", statKeys: ["npxG", "shots", "conversionRatio"] },
    { key: "creative", label: "Creative", statKeys: ["xA", "chancesCreated"] },
    { key: "aerial", label: "Aerial", statKeys: ["headersWonRatio", "aerialAttempts", "keyHeaders"] },
    { key: "defensive", label: "Defensive", statKeys: ["tackleRatio", "pressureRatio", "pressuresAttempted"] },
    { key: "passing", label: "Passing", statKeys: ["keyPasses"] },
    { key: "movement", label: "Movement", statKeys: ["dribbles"] },
  ],
};

export function getStatGroupsForRole(roleKey: string): StatGroup[] {
  return (ROLE_STAT_GROUPS[roleKey] ?? []).map((group) => ({
    ...group,
    description: GROUP_DESCRIPTIONS[group.key],
  }));
}
