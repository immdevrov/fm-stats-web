import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Spinner,
  Button,
  Heading,
  SimpleGrid,
  Badge,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo } from "react";
import { db } from "../services/db";
import type { Player, LeagueRanking } from "../types/types";
import {
  ROLE_CONFIG,
  INVERTED_STATS,
  LeftFullback,
  RightFullback,
  LeftWinger,
  RightWinger,
  type RoleConfig,
} from "../roles";
import { formatPositions, getEffectivePosition, formatWage, displayDate } from "../utils/utils";
import {
  extractPassingStats,
  extractDefensiveStats,
  extractAerialStats,
  extractPossessionStats,
  extractAttackingStats,
  extractCreativeStats,
  extractMovementStats,
  extractGoalkeeperStats,
} from "../types/stat-categories";
import { buildCohort, computePercentiles, type StatPercentile } from "../utils/comparison-utils";
import { PercentileBar } from "../components/PercentileBar";
import { PlayerAutocomplete } from "../components/PlayerAutocomplete";
import { PlayerStatusBadge } from "../components/PlayerStatusBadge";
import { useCompare } from "../contexts/CompareContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type Side = "both" | "left" | "right";

function getRoleClassForSide(config: RoleConfig, side: Side): RoleConfig["RoleClass"] {
  if (side === "both") return config.RoleClass;
  if (config.key === "FB") return side === "left" ? LeftFullback : RightFullback;
  if (config.key === "W") return side === "left" ? LeftWinger : RightWinger;
  return config.RoleClass;
}

interface PlayerPercentiles {
  player: Player;
  percentiles: StatPercentile[] | null;
}

export function CompareView() {
  useDocumentTitle("Compare");
  const { compareList, addPlayer, removePlayer } = useCompare();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [leagueRankings, setLeagueRankings] = useState<LeagueRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRoleIndex, setSelectedRoleIndex] = useState<number | null>(null);
  const [side, setSide] = useState<Side>("both");

  useEffect(() => {
    Promise.all([db.getAllPlayers(), db.getLeagueRankings()]).then(
      ([players, rankings]) => {
        setAllPlayers(players);
        setLeagueRankings(rankings);
        setIsLoading(false);
      }
    );
  }, []);

  const players = useMemo(() => {
    if (allPlayers.length === 0) return [];
    return compareList
      .map((uid) => allPlayers.find((p) => p.UID === uid))
      .filter((p): p is Player => !!p);
  }, [compareList, allPlayers]);

  useEffect(() => {
    if (players.length === 0) return;
    if (selectedRoleIndex !== null) return;
    const allMatch = ROLE_CONFIG.findIndex((rc) =>
      players.every((p) => rc.RoleClass.isRole(p))
    );
    if (allMatch !== -1) {
      setSelectedRoleIndex(allMatch); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const anyMatch = ROLE_CONFIG.findIndex((rc) =>
      players.some((p) => rc.RoleClass.isRole(p))
    );
    setSelectedRoleIndex(anyMatch !== -1 ? anyMatch : 0);
  }, [players, selectedRoleIndex]);

  const roleConfig = ROLE_CONFIG[selectedRoleIndex ?? 0];
  const hasSideSelector = roleConfig.key === "FB" || roleConfig.key === "W";

  useEffect(() => {
    setSide("both"); // eslint-disable-line react-hooks/set-state-in-effect
  }, [selectedRoleIndex]);

  const cohort = useMemo(() => {
    if (allPlayers.length === 0 || leagueRankings.length === 0) return [];
    const RoleClass = getRoleClassForSide(roleConfig, side);
    return buildCohort(allPlayers, RoleClass, leagueRankings);
  }, [allPlayers, leagueRankings, roleConfig, side]);

  const playerPercentiles: PlayerPercentiles[] = useMemo(() => {
    if (cohort.length === 0) return [];
    const RoleClass = getRoleClassForSide(roleConfig, side);
    return players.map((player) => {
      const matchesRole = RoleClass.isRole(player);
      if (!matchesRole) {
        return { player, percentiles: null } as PlayerPercentiles;
      }
      const playerRole = new RoleClass(player) as unknown as Record<string, unknown>;
      return {
        player,
        percentiles: computePercentiles(playerRole, cohort, roleConfig.statKeys),
      };
    });
  }, [players, cohort, roleConfig, side]);

  const autocompletePool = useMemo(() => {
    const RoleClass = getRoleClassForSide(roleConfig, side);
    return allPlayers.filter((p) => RoleClass.isRole(p));
  }, [allPlayers, roleConfig, side]);

  const excludeUids = useMemo(() => compareList, [compareList]);

  const handleAddPlayer = (player: Player) => {
    addPlayer(player.UID);
  };

  if (isLoading) {
    return (
      <Box p={4}>
        <Container maxW="container.xl">
          <VStack gap={4}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading data...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  const COLORS = ["glaucous", "spicyPaprika", "thistle"];

  return (
    <Box p={4}>
      <Container maxW="container.xl">
        <VStack gap={3} align="stretch">
          <HStack gap={2} flexWrap="wrap">
            {ROLE_CONFIG.map((rc, i) => (
              <Button
                key={rc.key}
                size="sm"
                variant={selectedRoleIndex === i ? "solid" : "outline"}
                colorPalette={selectedRoleIndex === i ? "glaucous" : undefined}
                onClick={() => setSelectedRoleIndex(i)}
              >
                {rc.name}
              </Button>
            ))}
            {hasSideSelector && (
              <>
                <Box w="1px" h="24px" bg="border.emphasized" mx={1} />
                {(["both", "left", "right"] as Side[]).map((s) => (
                  <Button
                    key={s}
                    size="xs"
                    variant={side === s ? "solid" : "outline"}
                    colorPalette={side === s ? "glaucous" : undefined}
                    onClick={() => setSide(s)}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </>
            )}
          </HStack>

          <SimpleGrid columns={3} gap={3}>
            {Array.from({ length: 3 }, (_, i) => {
              const player = players[i];
              return (
                <Box key={i} borderWidth="1px" borderRadius="md" p={3} minH="80px">
                  {player ? (
                    <VStack align="stretch" gap={1}>
                      <HStack justify="space-between">
                        <HStack gap={2}>
                          <Heading size="sm">{player.Name}</Heading>
                          <PlayerStatusBadge uid={player.UID} />
                        </HStack>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => removePlayer(player.UID)}
                        >
                          Remove
                        </Button>
                      </HStack>
                      <Text fontSize="xs" color="fg.muted">
                        {player.Club} | {formatPositions(getEffectivePosition(player))} | Age {player.Age}
                      </Text>
                      <Badge
                        colorPalette={COLORS[i]}
                        variant="subtle"
                        size="sm"
                        w="fit-content"
                      >
                        Player {i + 1}
                      </Badge>
                    </VStack>
                  ) : (
                    <PlayerAutocomplete
                      players={autocompletePool}
                      onChange={handleAddPlayer}
                      excludeUids={excludeUids}
                    />
                  )}
                </Box>
              );
            })}
          </SimpleGrid>

          {playerPercentiles.length > 0 && cohort.length > 0 ? (
            <>
              <Text fontSize="xs" color="fg.muted">
                Compared to {cohort.length} players in ranked leagues with 900+ mins
              </Text>
              <SimpleGrid columns={playerPercentiles.length} gap={3}>
                {playerPercentiles.map((pp) => (
                  <Box key={pp.player.UID} bg="bg.subtle" p={2} borderRadius="md">
                    <Text fontSize="sm" fontWeight="medium" mb={2}>
                      {pp.player.Name}
                    </Text>
                    {pp.percentiles ? (
                      <>
                        <HStack gap={2} mb={1}>
                          <Text w="120px" fontSize="xs" color="fg.muted" flexShrink={0}>Stat</Text>
                          <Text flex={1} fontSize="xs" color="fg.muted">Percentile</Text>
                          <Text w="32px" fontSize="xs" color="fg.muted" textAlign="right" flexShrink={0}>%</Text>
                          <Text w="50px" fontSize="xs" color="fg.muted" textAlign="right" flexShrink={0}>Value</Text>
                        </HStack>
                        <VStack align="stretch" gap={1}>
                          {pp.percentiles.map((stat) => (
                            <PercentileBar
                              key={stat.statKey}
                              label={stat.label}
                              value={stat.value}
                              percentile={stat.percentile}
                              inverted={INVERTED_STATS.has(stat.statKey)}
                            />
                          ))}
                        </VStack>
                      </>
                    ) : (
                      <Text fontSize="sm" color="fg.muted" py={4}>
                        {pp.player.Name} does not play the selected role
                      </Text>
                    )}
                  </Box>
                ))}
              </SimpleGrid>
            </>
          ) : (
            <Text color="fg.muted" textAlign="center" py={8}>
              Add players above to compare their percentiles
            </Text>
          )}

          {players.length > 0 && (
            <SimpleGrid columns={players.length} gap={3}>
              {players.map((player) => (
                <PlayerStatsColumn key={player.UID} player={player} />
              ))}
            </SimpleGrid>
          )}
        </VStack>
      </Container>
    </Box>
  );
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface StatItem {
  label: string;
  value: string;
}

function StatSection({ title, stats }: { title: string; stats: StatItem[] }) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={2}>
      <Heading size="xs" mb={1}>
        {title}
      </Heading>
      <VStack align="stretch" gap={0} fontSize="sm">
        {stats.map((stat) => (
          <HStack key={stat.label} justify="space-between">
            <Text color="fg.emphasized">{stat.label}</Text>
            <Text fontWeight="medium">{stat.value}</Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}

function PlayerStatsColumn({ player }: { player: Player }) {
  const isGoalkeeper = getEffectivePosition(player).some((pos) => pos.type === "GK");

  return (
    <VStack align="stretch" gap={2}>
      <StatSection
        title="Playing Time"
        stats={[
          { label: "Starts", value: String(player.Starts) },
          { label: "Minutes", value: player.Mins.toLocaleString() },
          { label: "Wage", value: formatWage(player.Wage) },
          { label: "Contract", value: player.Expires ? displayDate(player.Expires) : "-" },
        ]}
      />
      {isGoalkeeper ? (
        <GoalkeeperStats player={player} />
      ) : (
        <OutfieldStats player={player} />
      )}
    </VStack>
  );
}

function GoalkeeperStats({ player }: { player: Player }) {
  const gk = extractGoalkeeperStats(player);
  return (
    <StatSection
      title="Goalkeeper"
      stats={[
        { label: "Save %", value: formatPercent(gk.saveRatio) },
        { label: "Expected Save %", value: formatPercent(gk.expectedSaveRatio) },
        { label: "Goals Prevented", value: gk.goalsPrevented.toFixed(2) },
        { label: "Saves Held %", value: formatPercent(gk.savesHeldRatio) },
      ]}
    />
  );
}

function OutfieldStats({ player }: { player: Player }) {
  const passing = extractPassingStats(player);
  const defensive = extractDefensiveStats(player);
  const aerial = extractAerialStats(player);
  const possession = extractPossessionStats(player);
  const attacking = extractAttackingStats(player);
  const creative = extractCreativeStats(player);
  const movement = extractMovementStats(player);

  return (
    <SimpleGrid columns={2} gap={2}>
      <StatSection
        title="Passing"
        stats={[
          { label: "Pass %", value: formatPercent(passing.passRatio) },
          { label: "Prog. Passes", value: passing.progressivePasses.toFixed(2) },
          { label: "Key Passes", value: passing.keyPasses.toFixed(2) },
        ]}
      />
      <StatSection
        title="Defensive"
        stats={[
          { label: "Tackles", value: defensive.tackles.toFixed(2) },
          { label: "Tackle %", value: formatPercent(defensive.tackleRatio) },
          { label: "Press Ratio", value: defensive.pressuresSuccessful.toFixed(2) },
          { label: "Def. Contrib.", value: defensive.defensiveContributions.toFixed(2) },
        ]}
      />
      <StatSection
        title="Aerial"
        stats={[
          { label: "Hdrs Won %", value: formatPercent(aerial.headersWonRatio) },
          { label: "Aerial Att.", value: aerial.aerialAttempts.toFixed(2) },
          { label: "Key Headers", value: aerial.keyHeaders.toFixed(2) },
        ]}
      />
      <StatSection
        title="Possession"
        stats={[
          { label: "Poss Won", value: possession.possessionWon.toFixed(2) },
          { label: "Poss Lost", value: possession.possessionLost.toFixed(2) },
          { label: "Retention", value: possession.ballRetention.toFixed(2) },
        ]}
      />
      <StatSection
        title="Attacking"
        stats={[
          { label: "Goals", value: attacking.goals.toFixed(2) },
          { label: "npxG", value: attacking.npxG.toFixed(2) },
          { label: "xG Over", value: attacking.xGOverperformance.toFixed(2) },
          { label: "Shots", value: attacking.shots.toFixed(2) },
          { label: "Conv %", value: formatPercent(attacking.conversionRatio) },
        ]}
      />
      <StatSection
        title="Creative"
        stats={[
          { label: "xA", value: creative.xA.toFixed(2) },
          { label: "Chances", value: creative.chancesCreated.toFixed(2) },
        ]}
      />
      <StatSection
        title="Movement"
        stats={[
          { label: "Dribbles", value: movement.dribbles.toFixed(2) },
          { label: "Sprints", value: movement.sprints.toFixed(2) },
          { label: "Cross %", value: formatPercent(movement.crossRatio) },
          { label: "Crosses", value: movement.crossesSuccessful.toFixed(2) },
        ]}
      />
    </SimpleGrid>
  );
}
