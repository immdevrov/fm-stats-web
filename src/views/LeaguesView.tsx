import {
  Container,
  Heading,
  VStack,
  Box,
  Text,
  Spinner,
  HStack,
  Switch,
  Button,
  Input,
  Badge,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo } from "react";
import { db } from "../services/db";
import { Table, type Column } from "../components/ui/table";
import { formatWage, average } from "../utils/utils";
import type { Player, LeagueRanking } from "../types/types";
import { toaster } from "../components/ui/toaster";

interface LeagueData {
  league: string;
  rank: number; // positive integer for ranked, 999 for unranked (sorts to bottom)
  playerCount: number;
  averageWage: number;
  averageAge: number;
}

export function LeaguesView() {
  const [leagues, setLeagues] = useState<LeagueData[]>([]);
  const [badDataPlayers, setBadDataPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideUnknown, setHideUnknown] = useState(false);

  // Rankings state
  const [savedRankings, setSavedRankings] = useState<Map<string, number>>(new Map());
  const [isEditingRankings, setIsEditingRankings] = useState(false);
  const [editingRankings, setEditingRankings] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function loadData() {
      try {
        const [players, rankings] = await Promise.all([
          db.getAllPlayers(),
          db.getLeagueRankings(),
        ]);

        // Process league data
        const leagueMap = new Map<string, { wages: number[]; ages: number[] }>();
        const playersWithBadData: Player[] = [];

        for (const player of players) {
          const division = player.Division || "Unknown";
          if (division === "Unknown") {
            playersWithBadData.push(player);
          }
          if (!leagueMap.has(division)) {
            leagueMap.set(division, { wages: [], ages: [] });
          }
          const data = leagueMap.get(division)!;
          data.wages.push(player.Wage ?? 0);
          data.ages.push(player.Age);
        }

        // Process rankings first so we can include rank in league data
        const rankingsMap = new Map<string, number>();
        for (const ranking of rankings) {
          rankingsMap.set(ranking.league, ranking.rank);
        }

        const leagueData: LeagueData[] = [];
        for (const [league, data] of leagueMap) {
          leagueData.push({
            league,
            rank: rankingsMap.get(league) ?? 999, // 999 for unranked (sorts to bottom)
            playerCount: data.wages.length,
            averageWage: average(data.wages) ?? 0,
            averageAge: average(data.ages) ?? 0,
          });
        }

        setLeagues(leagueData);
        setBadDataPlayers(playersWithBadData);
        setSavedRankings(rankingsMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leagues");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
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

  const handleStartEditing = () => {
    // Initialize editing state from saved rankings
    const editMap = new Map<string, string>();
    for (const [league, rank] of savedRankings) {
      editMap.set(league, String(rank));
    }
    setEditingRankings(editMap);
    setIsEditingRankings(true);
  };

  const handleCancelEditing = () => {
    setEditingRankings(new Map());
    setIsEditingRankings(false);
  };

  const handleRankChange = (league: string, value: string) => {
    const newEditingRankings = new Map(editingRankings);
    if (value === "" || value === "0") {
      newEditingRankings.delete(league);
    } else {
      const num = parseInt(value);
      if (!isNaN(num) && num >= 1) {
        newEditingRankings.set(league, String(num));
      }
    }
    setEditingRankings(newEditingRankings);
  };

  const validateRankings = (): string | null => {
    const ranks = Array.from(editingRankings.values()).map((v) => parseInt(v));
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== ranks.length) {
      return "Ranks must be unique";
    }
    for (const rank of ranks) {
      if (rank < 1) {
        return "Ranks must be positive numbers";
      }
    }
    return null;
  };

  const handleSaveRankings = async () => {
    const validationError = validateRankings();
    if (validationError) {
      toaster.create({
        title: "Invalid Rankings",
        description: validationError,
        type: "error",
        duration: 5000,
      });
      return;
    }

    try {
      const rankings: LeagueRanking[] = [];
      for (const [league, rankStr] of editingRankings) {
        rankings.push({ league, rank: parseInt(rankStr) });
      }

      await db.saveLeagueRankings(rankings);

      // Update saved rankings state
      const newSavedRankings = new Map<string, number>();
      for (const { league, rank } of rankings) {
        newSavedRankings.set(league, rank);
      }
      setSavedRankings(newSavedRankings);

      // Update leagues data with new ranks
      setLeagues((prev) =>
        prev.map((league) => ({
          ...league,
          rank: newSavedRankings.get(league.league) ?? 999,
        }))
      );

      setIsEditingRankings(false);
      setEditingRankings(new Map());

      toaster.create({
        title: "Rankings Saved",
        description: `Saved ${rankings.length} league ranking${rankings.length !== 1 ? "s" : ""}`,
        type: "success",
        duration: 3000,
      });
    } catch (err) {
      toaster.create({
        title: "Failed to Save",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
        duration: 5000,
      });
    }
  };

  const columns: Column<LeagueData>[] = useMemo(() => {
    const cols: Column<LeagueData>[] = [
      {
        key: "league",
        header: "League",
      },
      {
        key: "rank",
        header: "Rank",
        sortable: !isEditingRankings,
        render: (value, row) => {
          if (isEditingRankings) {
            return (
              <Input
                size="sm"
                w="60px"
                type="number"
                min={1}
                placeholder="-"
                value={editingRankings.get(row.league) || ""}
                onChange={(e) => handleRankChange(row.league, e.target.value)}
              />
            );
          }
          const rank = value as number;
          return rank < 999 ? (
            <Badge colorPalette="blue" size="sm">
              #{rank}
            </Badge>
          ) : (
            <Text color="fg.muted">-</Text>
          );
        },
      },
      {
        key: "playerCount",
        header: "Players",
      },
      {
        key: "averageAge",
        header: "Avg Age",
        render: (value) => (value as number).toFixed(1),
      },
      {
        key: "averageWage",
        header: "Average Wage",
        render: (value) => formatWage(value as number),
      },
    ];

    return cols;
  }, [isEditingRankings, editingRankings]);

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
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
              Leagues
            </Heading>

            <HStack gap={4}>
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

              {isEditingRankings ? (
                <HStack gap={2}>
                  <Button size="sm" variant="ghost" onClick={handleCancelEditing}>
                    Cancel
                  </Button>
                  <Button size="sm" colorPalette="blue" onClick={handleSaveRankings}>
                    Save Rankings
                  </Button>
                </HStack>
              ) : (
                <Button size="sm" variant="outline" onClick={handleStartEditing}>
                  Edit Rankings
                </Button>
              )}
            </HStack>
          </HStack>

          {isEditingRankings && (
            <Box p={3} borderRadius="md" bg="bg.muted">
              <Text fontSize="sm" color="fg.muted">
                Enter rank numbers for your leagues (1 = best). Unranked leagues will appear at the bottom when sorting by rank.
              </Text>
            </Box>
          )}

          {filteredLeagues.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No player data found. Import players first.
            </Text>
          ) : (
            <Table
              data={filteredLeagues}
              columns={columns}
              defaultSortKey={savedRankings.size > 0 ? "rank" : "averageWage"}
              defaultSortDirection={savedRankings.size > 0 ? "asc" : "desc"}
            />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
