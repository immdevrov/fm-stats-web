import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Spinner,
  Button,
  Badge,
  SimpleGrid,
  Tabs,
  Checkbox,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../services/db";
import type { Player, LeagueRanking } from "../types/types";
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
import { formatWage, displayDate, formatPositions, getPercentile, getColumn } from "../utils/utils";
import { ROLE_CONFIG, STAT_LABELS, type RoleConfig } from "../roles";
import { PercentileBar } from "../components/PercentileBar";

export function PlayerProfileView() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlayer() {
      if (!playerId) {
        setError("No player ID specified");
        setIsLoading(false);
        return;
      }

      try {
        const uid = parseInt(playerId, 10);
        if (isNaN(uid)) {
          setError("Invalid player ID");
          setIsLoading(false);
          return;
        }

        const playerData = await db.getPlayer(uid);
        if (!playerData) {
          setError("Player not found");
          setIsLoading(false);
          return;
        }

        setPlayer(playerData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load player");
      } finally {
        setIsLoading(false);
      }
    }

    loadPlayer();
  }, [playerId]);

  if (isLoading) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.xl">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading player...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (error || !player) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.xl">
          <VStack gap={4}>
            <Box p={4} borderRadius="md" bg="red.500" color="white">
              <Text fontWeight="medium">{error || "Player not found"}</Text>
            </Box>
            <Button variant="outline" onClick={() => navigate("/players")}>
              Back to Players
            </Button>
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh" p={3}>
      <Container maxW="container.xl">
        <HStack align="start" gap={3}>
            <PlayerInfoColumn player={player} />

            <ComparisonColumn player={player} />
          </HStack>
      </Container>
    </Box>
  );
}

function PlayerInfoColumn({ player }: { player: Player }) {
  const isGoalkeeper = player.Position.some((pos) => pos.type === "GK");

  return (
    <VStack w="40%" align="stretch" gap={2}>
      <PlayerHeader player={player} />
      <PlayingTimeSection player={player} />

      {isGoalkeeper ? (
        <GoalkeeperStatsSection player={player} />
      ) : (
        <OutfieldStatsSection player={player} />
      )}
    </VStack>
  );
}

function PlayerHeader({ player }: { player: Player }) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={2}>
      <VStack align="stretch" gap={1}>
        <HStack justify="space-between" align="start">
          <Heading size="lg" color="fg.emphasized">
            {player.Name}
          </Heading>
          <Badge colorPalette="glaucous" variant="subtle" fontSize="xs">
            UID: {player.UID}
          </Badge>
        </HStack>

        <VStack align="stretch" gap={0} fontSize="sm">
          <HStack justify="space-between">
            <Text color="fg.emphasized">Club</Text>
            <Link to={`/teams/${encodeURIComponent(player.Club)}`}>
              <Text fontWeight="medium" color="glaucous.400" _hover={{ textDecoration: "underline" }}>
                {player.Club}
              </Text>
            </Link>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.emphasized">Division</Text>
            <Text fontWeight="medium">{player.Division}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.emphasized">Nationality</Text>
            <Text fontWeight="medium">{player.Nat}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.emphasized">Position</Text>
            <Text fontWeight="medium">{formatPositions(player.Position)}</Text>
          </HStack>
        </VStack>

        <HStack gap={4} pt={1} borderTopWidth="1px">
          <VStack gap={0}>
            <Text color="fg.emphasized" fontSize="xs">
              Age
            </Text>
            <Text fontWeight="medium" fontSize="sm">{player.Age}</Text>
          </VStack>
          <VStack gap={0}>
            <Text color="fg.emphasized" fontSize="xs">
              Height
            </Text>
            <Text fontWeight="medium" fontSize="sm">{player.Height} cm</Text>
          </VStack>
          <VStack gap={0}>
            <Text color="fg.emphasized" fontSize="xs">
              Weight
            </Text>
            <Text fontWeight="medium" fontSize="sm">{player.Weight} kg</Text>
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
}

function PlayingTimeSection({ player }: { player: Player }) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={2}>
      <Heading size="sm" mb={1}>
        Playing Time & Contract
      </Heading>
      <VStack align="stretch" gap={0} fontSize="sm">
        <HStack justify="space-between">
          <Text color="fg.emphasized">Starts</Text>
          <Text fontWeight="medium">{player.Starts}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text color="fg.emphasized">Minutes</Text>
          <Text fontWeight="medium">{player.Mins.toLocaleString()}</Text>
        </HStack>
        <HStack justify="space-between">
          <Text color="fg.emphasized">Recent Injuries</Text>
          <Text fontWeight="medium" color={player.RcInjury ? "red.500" : "fg.emphasized"}>
            {player.RcInjury ? "Yes" : "No"}
          </Text>
        </HStack>
        <HStack justify="space-between">
          <Text color="fg.emphasized">Contract Expires</Text>
          <Text fontWeight="medium">
            {player.Expires ? displayDate(player.Expires) : "-"}
          </Text>
        </HStack>
        <HStack justify="space-between">
          <Text color="fg.emphasized">Wage</Text>
          <Text fontWeight="medium">{formatWage(player.Wage)}</Text>
        </HStack>
      </VStack>
    </Box>
  );
}

function OutfieldStatsSection({ player }: { player: Player }) {
  const passingStats = extractPassingStats(player);
  const defensiveStats = extractDefensiveStats(player);
  const aerialStats = extractAerialStats(player);
  const possessionStats = extractPossessionStats(player);
  const attackingStats = extractAttackingStats(player);
  const creativeStats = extractCreativeStats(player);
  const movementStats = extractMovementStats(player);

  return (
    <SimpleGrid columns={2} gap={2}>
      <StatSection
        title="Passing"
        stats={[
          { label: "Pass %", value: formatPercent(passingStats.passRatio) },
          { label: "Prog. Passes", value: passingStats.progressivePasses.toFixed(2) },
          { label: "Key Passes", value: passingStats.keyPasses.toFixed(2) },
        ]}
      />

      <StatSection
        title="Defensive"
        stats={[
          { label: "Tackles", value: defensiveStats.tackles.toFixed(2) },
          { label: "Tackle %", value: formatPercent(defensiveStats.tackleRatio) },
          { label: "Pressures", value: defensiveStats.pressuresSuccessful.toFixed(2) },
        ]}
      />

      <StatSection
        title="Aerial"
        stats={[
          { label: "Hdrs Won %", value: formatPercent(aerialStats.headersWonRatio) },
          { label: "Aerial Att.", value: aerialStats.aerialAttempts.toFixed(2) },
          { label: "Key Headers", value: aerialStats.keyHeaders.toFixed(2) },
        ]}
      />

      <StatSection
        title="Possession"
        stats={[
          { label: "Poss Won", value: possessionStats.possessionWon.toFixed(2) },
          { label: "Poss Lost", value: possessionStats.possessionLost.toFixed(2) },
          { label: "Retention", value: possessionStats.ballRetention.toFixed(2) },
        ]}
      />

      <StatSection
        title="Attacking"
        stats={[
          { label: "Goals", value: attackingStats.goals.toFixed(2) },
          { label: "npxG", value: attackingStats.npxG.toFixed(2) },
          { label: "xG Over", value: attackingStats.xGOverperformance.toFixed(2) },
          { label: "Shots", value: attackingStats.shots.toFixed(2) },
          { label: "Conv %", value: formatPercent(attackingStats.conversionRatio) },
        ]}
      />

      <StatSection
        title="Creative"
        stats={[
          { label: "xA", value: creativeStats.xA.toFixed(2) },
          { label: "Chances", value: creativeStats.chancesCreated.toFixed(2) },
        ]}
      />

      <StatSection
        title="Movement"
        stats={[
          { label: "Dribbles", value: movementStats.dribbles.toFixed(2) },
          { label: "Sprints", value: movementStats.sprints.toFixed(2) },
          { label: "Cross %", value: formatPercent(movementStats.crossRatio) },
          { label: "Crosses", value: movementStats.crossesSuccessful.toFixed(2) },
        ]}
      />
    </SimpleGrid>
  );
}

function GoalkeeperStatsSection({ player }: { player: Player }) {
  const gkStats = extractGoalkeeperStats(player);

  return (
    <StatSection
      title="Goalkeeper"
      stats={[
        { label: "Save %", value: formatPercent(gkStats.saveRatio) },
        { label: "Expected Save %", value: formatPercent(gkStats.expectedSaveRatio) },
        { label: "Goals Prevented", value: gkStats.goalsPrevented.toFixed(2) },
        { label: "Saves Held %", value: formatPercent(gkStats.savesHeldRatio) },
      ]}
    />
  );
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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface StatPercentile {
  statKey: string;
  label: string;
  value: number;
  percentile: number;
}

function getPlayerRoles(player: Player): RoleConfig[] {
  return ROLE_CONFIG.filter(({ RoleClass }) => RoleClass.isRole(player));
}

function getComparisonCohort(
  RoleClass: RoleConfig["RoleClass"],
  allPlayers: Player[],
  leagueRankings: LeagueRanking[],
  sameLeagueOnly?: string
): Record<string, unknown>[] {
  const rankedLeagues = new Set(
    leagueRankings.filter((r) => r.rank < 999).map((r) => r.league)
  );

  return allPlayers
    .filter(
      (p) =>
        RoleClass.isRole(p) &&
        rankedLeagues.has(p.Division) &&
        p.Starts >= 5 &&
        (!sameLeagueOnly || p.Division === sameLeagueOnly)
    )
    .map((p) => new RoleClass(p) as unknown as Record<string, unknown>);
}

function calculateRolePercentiles(
  playerRole: Record<string, unknown>,
  cohort: Record<string, unknown>[],
  statKeys: string[]
): StatPercentile[] {
  return statKeys.map((key) => {
    const playerValue = playerRole[key] as number;
    const cohortValues = getColumn(cohort, key) as number[];

    return {
      statKey: key,
      label: STAT_LABELS[key] ?? key,
      value: playerValue,
      percentile: getPercentile(playerValue, cohortValues),
    };
  });
}

function ComparisonColumn({ player }: { player: Player }) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [leagueRankings, setLeagueRankings] = useState<LeagueRanking[]>([]);
  const [percentiles, setPercentiles] = useState<StatPercentile[]>([]);
  const [cohortSize, setCohortSize] = useState(0);
  const [sameLeagueOnly, setSameLeagueOnly] = useState(false);

  const applicableRoles = useMemo(() => getPlayerRoles(player), [player]);

  useEffect(() => {
    Promise.all([db.getAllPlayers(), db.getLeagueRankings()]).then(
      ([players, rankings]) => {
        setAllPlayers(players);
        setLeagueRankings(rankings);
      }
    );
  }, []);

  useEffect(() => {
    if (applicableRoles.length > 0 && !selectedRole) {
      setSelectedRole(applicableRoles[0].key);
    }
  }, [applicableRoles, selectedRole]);

  useEffect(() => {
    if (!selectedRole || !allPlayers.length) return;

    const roleConfig = ROLE_CONFIG.find((r) => r.key === selectedRole);
    if (!roleConfig) return;

    const cohort = getComparisonCohort(
      roleConfig.RoleClass,
      allPlayers,
      leagueRankings,
      sameLeagueOnly ? player.Division : undefined
    );
    const playerRole = new roleConfig.RoleClass(player) as unknown as Record<string, unknown>;
    const stats = calculateRolePercentiles(
      playerRole,
      cohort,
      roleConfig.statKeys
    );

    setCohortSize(cohort.length);
    setPercentiles(stats);
  }, [selectedRole, allPlayers, leagueRankings, player, sameLeagueOnly]);

  if (applicableRoles.length === 0) {
    return (
      <Box flex={1} bg="bg.subtle" p={2} borderRadius="md" minH="300px">
        <Text color="fg.muted">No applicable roles found for this player</Text>
      </Box>
    );
  }

  const comparisonText = sameLeagueOnly
    ? `Compared to ${cohortSize} players in ${player.Division} with 5+ starts`
    : `Compared to ${cohortSize} players in ranked leagues with 5+ starts`;

  return (
    <Box flex={1} bg="bg.subtle" p={2} borderRadius="md" minH="300px">
      <Tabs.Root
        value={selectedRole ?? undefined}
        onValueChange={(e) => setSelectedRole(e.value)}
      >
        <Tabs.List>
          {applicableRoles.map((role) => (
            <Tabs.Trigger key={role.key} value={role.key}>
              {role.name}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>

      <HStack justify="space-between" align="flex-start" mt={2} minH="36px">
        <Text fontSize="xs" color="fg.muted">
          {comparisonText}
        </Text>
        <Checkbox.Root
          size="sm"
          checked={sameLeagueOnly}
          onCheckedChange={(e) => setSameLeagueOnly(!!e.checked)}
          flexShrink={0}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>
            <Text fontSize="xs">Same league only</Text>
          </Checkbox.Label>
        </Checkbox.Root>
      </HStack>

      <HStack gap={2} mt={3} mb={1}>
        <Text w="120px" fontSize="xs" color="fg.muted" flexShrink={0}>
          Stat
        </Text>
        <Text flex={1} fontSize="xs" color="fg.muted">
          Percentile
        </Text>
        <Text w="32px" fontSize="xs" color="fg.muted" textAlign="right" flexShrink={0}>
          %
        </Text>
        <Text w="50px" fontSize="xs" color="fg.muted" textAlign="right" flexShrink={0}>
          Value
        </Text>
      </HStack>
      <VStack align="stretch" gap={1}>
        {percentiles.map((stat) => (
          <PercentileBar
            key={stat.statKey}
            label={stat.label}
            value={stat.value}
            percentile={stat.percentile}
          />
        ))}
      </VStack>
    </Box>
  );
}
