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
  Dialog,
  Portal,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCompare } from "../contexts/CompareContext";
import { db } from "../services/db";
import type { Player, LeagueRanking } from "../types/types";
import type { PlayerPosition, PlayerPositions } from "../fields/positions";
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
import { formatWage, displayDate, formatPositions, getEffectivePosition, getPercentile, getColumn } from "../utils/utils";
import { ROLE_CONFIG, STAT_LABELS, INVERTED_STATS, type RoleConfig } from "../roles";
import { PercentileBar } from "../components/PercentileBar";
import { SimilarPlayers } from "../components/SimilarPlayers";
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { PricingFields } from "../components/PricingFields";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function PlayerProfileView() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(player ? `Player: ${player.Name}` : "Player");

  const reloadPlayer = useCallback(async () => {
    if (!playerId) return;
    const uid = parseInt(playerId, 10);
    if (isNaN(uid)) return;
    const updated = await db.getPlayer(uid);
    if (updated) setPlayer(updated);
  }, [playerId]);

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
          <PlayerInfoColumn player={player} onPlayerUpdate={reloadPlayer} />

          <ComparisonColumn player={player} />
        </HStack>
      </Container>
    </Box>
  );
}

function PlayerInfoColumn({ player, onPlayerUpdate }: { player: Player; onPlayerUpdate: () => Promise<void> }) {
  const isGoalkeeper = getEffectivePosition(player).some((pos) => pos.type === "GK");

  return (
    <VStack w="40%" align="stretch" gap={2}>
      <PlayerHeader player={player} onPlayerUpdate={onPlayerUpdate} />
      <PricingSection key={player.UID} player={player} />
      <PlayingTimeSection player={player} />

      {isGoalkeeper ? (
        <GoalkeeperStatsSection player={player} />
      ) : (
        <OutfieldStatsSection player={player} />
      )}
    </VStack>
  );
}

function PricingSection({ player }: { player: Player }) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={2}>
      <Heading size="sm" mb={1}>
        Pricing
      </Heading>
      <PricingFields uid={player.UID} player={{ Name: player.Name, Club: player.Club }} />
    </Box>
  );
}

const POSITION_TYPES = ["GK", "D", "WB", "DM", "M", "AM", "ST"] as const;
const SIDES = ["L", "C", "R"] as const;

function PlayerHeader({ player, onPlayerUpdate }: { player: Player; onPlayerUpdate: () => Promise<void> }) {
  const { compareList, addPlayer } = useCompare();
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [editPositions, setEditPositions] = useState<PlayerPositions>([]);
  const isInCompare = compareList.includes(player.UID);

  const handleAddToCompare = () => {
    const added = addPlayer(player.UID);
    if (!added) return;
    if (compareList.length >= 1) {
      setShowDialog(true);
    }
  };

  const openPositionEditor = () => {
    setEditPositions(structuredClone(getEffectivePosition(player)));
    setShowPositionEditor(true);
  };

  const isTypeChecked = (type: string) => editPositions.some((p) => p.type === type);

  const isSideChecked = (type: string, side: string) =>
    editPositions.some((p) => p.type === type && p.side?.includes(side as "L" | "C" | "R"));

  const toggleType = (type: string) => {
    if (isTypeChecked(type)) {
      setEditPositions((prev) => prev.filter((p) => p.type !== type));
    } else {
      const newPos: PlayerPosition = { type: type as PlayerPosition["type"] };
      if (type !== "GK") {
        newPos.side = [];
      }
      setEditPositions((prev) => [...prev, newPos]);
    }
  };

  const toggleSide = (type: string, side: "L" | "C" | "R") => {
    setEditPositions((prev) =>
      prev.map((p) => {
        if (p.type !== type) return p;
        const sides = p.side ?? [];
        const newSides = sides.includes(side)
          ? sides.filter((s) => s !== side)
          : [...sides, side].sort((a, b) => SIDES.indexOf(a) - SIDES.indexOf(b));
        return { ...p, side: newSides as PlayerPosition["side"] };
      })
    );
  };

  const handleSavePosition = async () => {
    const filtered = editPositions.filter(
      (p) => p.type === "GK" || (p.side && p.side.length > 0)
    );
    if (filtered.length === 0) return;
    await db.updatePlayerPosition(player.UID, filtered);
    await onPlayerUpdate();
    setShowPositionEditor(false);
  };

  const handleClearCustomPosition = async () => {
    await db.clearPlayerCustomPosition(player.UID);
    await onPlayerUpdate();
  };

  const hasValidSelection = editPositions.some(
    (p) => p.type === "GK" || (p.side && p.side.length > 0)
  );

  return (
    <Box borderWidth="1px" borderRadius="md" p={2}>
      <VStack align="stretch" gap={1}>
        <HStack justify="space-between" align="start">
          <Heading size="lg" color="fg.emphasized">
            {player.Name}
          </Heading>
          <HStack gap={2}>
            <Button
              size="xs"
              variant={isInCompare ? "subtle" : "outline"}
              colorPalette="glaucous"
              disabled={isInCompare}
              onClick={handleAddToCompare}
            >
              {isInCompare ? "In Compare" : "Add to Compare"}
            </Button>
            <Badge colorPalette="glaucous" variant="subtle" fontSize="xs">
              UID: {player.UID}
            </Badge>
          </HStack>
        </HStack>

        <Dialog.Root open={showDialog} onOpenChange={(e) => setShowDialog(e.open)}>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Player Added</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Text>{player.Name} has been added to the compare list. Would you like to go to the compare view?</Text>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Stay Here
                  </Button>
                  <Button
                    colorPalette="glaucous"
                    onClick={() => {
                      setShowDialog(false);
                      navigate("/compare");
                    }}
                  >
                    Go to Compare
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>

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
            <HStack gap={1}>
              <Text fontWeight="medium">{formatPositions(getEffectivePosition(player))}</Text>
              <PlayerStatusControl uid={player.UID} player={{ Name: player.Name, Club: player.Club }} />
              {player.CustomPosition && (
                <Badge colorPalette="glaucous" variant="subtle" size="sm">Edited</Badge>
              )}
              <Button size="xs" variant="ghost" onClick={openPositionEditor} p={0} minW="auto" h="auto">
                <Text fontSize="xs">&#9998;</Text>
              </Button>
              {player.CustomPosition && (
                <Button size="xs" variant="ghost" colorPalette="red" onClick={handleClearCustomPosition} p={0} minW="auto" h="auto">
                  <Text fontSize="xs">&#10005;</Text>
                </Button>
              )}
            </HStack>
          </HStack>
        </VStack>

        <Dialog.Root open={showPositionEditor} onOpenChange={(e) => setShowPositionEditor(e.open)}>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Edit Position</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <VStack align="stretch" gap={2}>
                    {POSITION_TYPES.map((type) => (
                      <Box key={type}>
                        <Checkbox.Root
                          checked={isTypeChecked(type)}
                          onCheckedChange={() => toggleType(type)}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                          <Checkbox.Label>
                            <Text fontWeight="medium">{type}</Text>
                          </Checkbox.Label>
                        </Checkbox.Root>
                        {type !== "GK" && isTypeChecked(type) && (
                          <HStack gap={3} ml={6} mt={1}>
                            {SIDES.map((side) => (
                              <Checkbox.Root
                                key={side}
                                size="sm"
                                checked={isSideChecked(type, side)}
                                onCheckedChange={() => toggleSide(type, side)}
                              >
                                <Checkbox.HiddenInput />
                                <Checkbox.Control />
                                <Checkbox.Label>
                                  <Text fontSize="sm">{side}</Text>
                                </Checkbox.Label>
                              </Checkbox.Root>
                            ))}
                          </HStack>
                        )}
                      </Box>
                    ))}
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="outline" onClick={() => setShowPositionEditor(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorPalette="glaucous"
                    disabled={!hasValidSelection}
                    onClick={handleSavePosition}
                  >
                    Save
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>

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
          { label: "Press Ratio", value: defensiveStats.pressuresSuccessful.toFixed(2) },
          { label: "Def. Contrib.", value: defensiveStats.defensiveContributions.toFixed(2) },
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
  const [shotStoppingRank, setShotStoppingRank] = useState<number | null>(null);

  useEffect(() => {
    const gkConfig = ROLE_CONFIG.find((r) => r.key === "GK");
    if (!gkConfig) return;

    Promise.all([db.getAllPlayers(), db.getLeagueRankings()]).then(
      ([allPlayers, leagueRankings]) => {
        const cohort = getComparisonCohort(gkConfig.RoleClass, allPlayers, leagueRankings);
        if (cohort.length === 0) return;

        const playerRole = new gkConfig.RoleClass(player) as unknown as Record<string, number>;
        const keys = ["saveRatio", "savesPer90", "concededPer90"] as const;
        const percentiles: Record<string, number> = {};

        for (const key of keys) {
          const col = (getColumn(cohort, key) as number[]).slice().sort((a, b) => a - b);
          percentiles[key] = getPercentile(playerRole[key], col);
        }

        const derived = gkConfig.derivedPercentileStats?.find((d) => d.key === "shotStoppingRank");
        if (!derived) return;

        const rank = derived.formula(percentiles);

        const allRanks = cohort.map((c) => {
          const p: Record<string, number> = {};
          for (const key of keys) {
            const col = (getColumn(cohort, key) as number[]).slice().sort((a, b) => a - b);
            p[key] = getPercentile(c[key] as number, col);
          }
          return derived.formula(p);
        }).sort((a, b) => a - b);

        setShotStoppingRank(getPercentile(rank, allRanks));
      }
    );
  }, [player]);

  return (
    <StatSection
      title="Goalkeeper"
      stats={[
        { label: "Save %", value: formatPercent(gkStats.saveRatio) },
        { label: "Expected Save %", value: formatPercent(gkStats.expectedSaveRatio) },
        { label: "Goals Prevented", value: gkStats.goalsPrevented.toFixed(2) },
        { label: "Saves Held %", value: formatPercent(gkStats.savesHeldRatio) },
        { label: "Conceded", value: gkStats.concededPer90.toFixed(2) },
        { label: "Saves", value: gkStats.savesPer90.toFixed(2) },
        { label: "Shot Stopping Rank", value: shotStoppingRank !== null ? `${shotStoppingRank.toFixed(0)}th pctl` : "-" },
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
        p.Mins >= 900 &&
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
  const [cohort, setCohort] = useState<Record<string, unknown>[]>([]);

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
      setSelectedRole(applicableRoles[0].key); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [applicableRoles, selectedRole]);

  useEffect(() => {
    if (!selectedRole || !allPlayers.length) return;

    const roleConfig = ROLE_CONFIG.find((r) => r.key === selectedRole);
    if (!roleConfig) return;

    const newCohort = getComparisonCohort(
      roleConfig.RoleClass,
      allPlayers,
      leagueRankings,
      sameLeagueOnly ? player.Division : undefined
    );

    setCohort(newCohort); // eslint-disable-line react-hooks/set-state-in-effect
    setCohortSize(newCohort.length);

    if (newCohort.length === 0) {
      setPercentiles([]);
      return;
    }

    const playerRole = new roleConfig.RoleClass(player) as unknown as Record<string, unknown>;
    const stats = calculateRolePercentiles(
      playerRole,
      newCohort,
      roleConfig.statKeys
    );
    setPercentiles(stats);
  }, [selectedRole, allPlayers, leagueRankings, player, sameLeagueOnly]);

  const currentRoleConfig = ROLE_CONFIG.find((r) => r.key === selectedRole);
  const targetPercentiles = useMemo(() => {
    const map: Record<string, number> = {};
    for (const stat of percentiles) {
      map[stat.statKey] = stat.percentile;
    }
    return map;
  }, [percentiles]);

  if (applicableRoles.length === 0) {
    return (
      <Box flex={1} bg="bg.subtle" p={2} borderRadius="md" minH="300px">
        <Text color="fg.muted">No applicable roles found for this player</Text>
      </Box>
    );
  }

  const comparisonText = sameLeagueOnly
    ? `Compared to ${cohortSize} players in ${player.Division} with 900+ mins`
    : `Compared to ${cohortSize} players in ranked leagues with 900+ mins`;

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
        {cohortSize === 0 ? (
          <Text color="fg.muted" fontSize="sm" py={4}>
            No comparable players found in {sameLeagueOnly ? "this league" : "ranked leagues"} with 5+ starts.
          </Text>
        ) : (
          percentiles.map((stat) => (
            <PercentileBar
              key={stat.statKey}
              label={stat.label}
              value={stat.value}
              percentile={stat.percentile}
              inverted={INVERTED_STATS.has(stat.statKey)}
            />
          ))
        )}
      </VStack>

      {currentRoleConfig && (
        <SimilarPlayers
          playerUid={player.UID}
          roleConfig={currentRoleConfig}
          cohort={cohort}
          targetPercentiles={targetPercentiles}
        />
      )}
    </Box>
  );
}
