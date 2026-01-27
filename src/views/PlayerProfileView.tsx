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
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../services/db";
import type { Player } from "../types/types";
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
import { formatWage, displayDate, formatPositions } from "../utils/utils";

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

            <Box flex={1} bg="bg.subtle" p={2} borderRadius="md" minH="300px">
              <Text color="fg.muted">Comparison graphs coming soon</Text>
              <Text color="fg.muted">Similar players coming soon</Text>
            </Box>
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
            <Text fontWeight="medium">{player.Club}</Text>
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
