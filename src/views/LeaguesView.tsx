import { Container, Heading, VStack, Box, Text, Spinner, HStack, Switch } from "@chakra-ui/react";
import { useState, useEffect, useMemo } from "react";
import { db } from "../services/db";
import { Table, type Column } from "../components/ui/table";
import { formatWage, average } from "../utils/utils";
import type { Player } from "../types/types";

interface LeagueData {
  league: string;
  playerCount: number;
  averageWage: number;
}

export function LeaguesView() {
  const [leagues, setLeagues] = useState<LeagueData[]>([]);
  const [badDataPlayers, setBadDataPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideUnknown, setHideUnknown] = useState(false);

  useEffect(() => {
    async function loadLeagues() {
      try {
        const players = await db.getAllPlayers();

        const leagueMap = new Map<string, number[]>();
        const playersWithBadData: Player[] = [];

        for (const player of players) {
          const division = player.Division || "Unknown";
          if (division === "Unknown") {
            playersWithBadData.push(player);
          }
          if (!leagueMap.has(division)) {
            leagueMap.set(division, []);
          }
          leagueMap.get(division)!.push(player.Wage ?? 0);
        }

        const leagueData: LeagueData[] = [];
        for (const [league, wages] of leagueMap) {
          leagueData.push({
            league,
            playerCount: wages.length,
            averageWage: average(wages) ?? 0,
          });
        }

        setLeagues(leagueData);
        setBadDataPlayers(playersWithBadData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leagues");
      } finally {
        setIsLoading(false);
      }
    }

    loadLeagues();
  }, []);

  const filteredLeagues = useMemo(() => {
    if (!hideUnknown) return leagues;
    return leagues.filter((league) => league.league !== "Unknown");
  }, [leagues, hideUnknown]);

  const handleToggleUnknown = () => {
    const newValue = !hideUnknown;
    setHideUnknown(newValue);
    if (newValue && badDataPlayers.length > 0) {
      console.log("Players with bad data (Unknown league):", badDataPlayers);
    }
  };

  const columns: Column<LeagueData>[] = [
    {
      key: "league",
      header: "League",
    },
    {
      key: "playerCount",
      header: "Players",
    },
    {
      key: "averageWage",
      header: "Average Wage",
      render: (value) => formatWage(value as number),
    },
  ];

  if (isLoading) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading leagues...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <Box p={4} borderRadius="md" bg="red.500" color="white">
            <Text fontWeight="medium">{error}</Text>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.lg">
        <VStack gap={8} align="stretch">
          <HStack justify="space-between" align="center">
            <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
              Leagues
            </Heading>

            {leagues.some((l) => l.league === "Unknown") && (
              <HStack gap={2}>
                <Text fontSize="sm" color="fg.muted">
                  Hide unknown
                </Text>
                <Switch.Root checked={hideUnknown} onCheckedChange={handleToggleUnknown}>
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Root>
              </HStack>
            )}
          </HStack>

          {filteredLeagues.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No player data found. Import players first.
            </Text>
          ) : (
            <Table
              data={filteredLeagues}
              columns={columns}
              defaultSortKey="averageWage"
              defaultSortDirection="desc"
            />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
