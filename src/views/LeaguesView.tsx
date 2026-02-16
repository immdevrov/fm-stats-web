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
import { Table, type Column, type SortDirection } from "../components/ui/table";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof LeagueData>("averageWage");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const pageSize = 20;

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

  const sortedLeagues = useMemo(() => {
    let result = leagues.filter((league) => league.playerCount >= 10);
    if (hideUnknown) {
      result = result.filter((league) => league.league !== "Unknown");
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [leagues, hideUnknown, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedLeagues.length / pageSize);
  const paginatedLeagues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLeagues.slice(start, start + pageSize);
  }, [sortedLeagues, currentPage]);

  const handleSortChange = (key: keyof LeagueData, direction: SortDirection) => {
    setSortKey(key);
    setSortDirection(direction);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [hideUnknown]);

  useEffect(() => {
    if (savedRankings.size > 0) {
      setSortKey("rank");
      setSortDirection("asc");
    }
  }, [savedRankings]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

          {sortedLeagues.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No player data found. Import players first.
            </Text>
          ) : (
            <>
              <Table
                data={paginatedLeagues}
                columns={columns}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
              />
              {totalPages > 1 && (
                <HStack justify="center" gap={2}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Text fontSize="sm" color="fg.muted">
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </HStack>
              )}
            </>
          )}
        </VStack>
      </Container>
    </Box>
  );
}
