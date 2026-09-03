import {
  Container,
  Heading,
  VStack,
  Box,
  Text,
  Spinner,
  HStack,
  Input,
  Button,
} from "@chakra-ui/react";
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRoster } from "../contexts/SnapshotContext";
import { Table, type Column, type SortDirection } from "../components/ui/table";
import { SearchableSelect } from "../components/SearchableSelect";
import { formatWage, average } from "../utils/utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

interface TeamData {
  name: string;
  league: string;
  playerCount: number;
  averageWage: number;
  averageAge: number;
}

const ITEMS_PER_PAGE = 20;
const MIN_SEARCH_LENGTH = 3;

export function TeamsView() {
  useDocumentTitle("Teams");
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeague, setSelectedLeague] = useState<string>("");

  const [sortKey, setSortKey] = useState<keyof TeamData>("averageWage");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const { players, error } = useRoster();

  const { teams, leagues } = useMemo(() => {
    const clubMap = new Map<string, { league: string; wages: number[]; ages: number[] }>();
    const leagueSet = new Set<string>();

    for (const player of players ?? []) {
      const club = player.Club || "Unknown";
      const league = player.Division || "Unknown";

      leagueSet.add(league);

      if (!clubMap.has(club)) {
        clubMap.set(club, { league, wages: [], ages: [] });
      }
      const data = clubMap.get(club)!;
      data.wages.push(player.Wage ?? 0);
      data.ages.push(player.Age);
    }

    const teamData: TeamData[] = [];
    for (const [name, data] of clubMap) {
      teamData.push({
        name,
        league: data.league,
        playerCount: data.wages.length,
        averageWage: average(data.wages) ?? 0,
        averageAge: average(data.ages) ?? 0,
      });
    }

    return { teams: teamData, leagues: Array.from(leagueSet).sort() };
  }, [players]);

  const isLoading = players === null;

  const filteredAndSortedTeams = useMemo(() => {
    let result = teams;

    if (selectedLeague) {
      result = result.filter((team) => team.league === selectedLeague);
    }

    if (searchQuery.length >= MIN_SEARCH_LENGTH) {
      const lowerSearch = searchQuery.toLowerCase();
      result = result.filter((team) =>
        team.name.toLowerCase().includes(lowerSearch)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    return result;
  }, [teams, searchQuery, selectedLeague, sortKey, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedTeams.length / ITEMS_PER_PAGE);
  const paginatedTeams = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedTeams.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedTeams, currentPage]);

  const filterKey = `${searchQuery}|${selectedLeague}|${sortKey}|${sortDirection}`;
  const [pagedFor, setPagedFor] = useState(filterKey);
  if (pagedFor !== filterKey) {
    setPagedFor(filterKey);
    setCurrentPage(1);
  }

  const handleTeamClick = useCallback(
    (team: TeamData) => {
      navigate(`/teams/${encodeURIComponent(team.name)}`);
    },
    [navigate]
  );

  const handleSortChange = useCallback(
    (key: keyof TeamData, direction: SortDirection) => {
      setSortKey(key);
      setSortDirection(direction);
    },
    []
  );

  const columns: Column<TeamData>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        render: (value, row) => (
          <Text
            cursor="pointer"
            color="glaucous.500"
            _hover={{ textDecoration: "underline" }}
            onClick={() => handleTeamClick(row)}
          >
            {value as string}
          </Text>
        ),
      },
      {
        key: "league",
        header: "League",
      },
      {
        key: "averageWage",
        header: "Avg Wage",
        render: (value) => formatWage(value as number),
      },
      {
        key: "averageAge",
        header: "Avg Age",
        render: (value) => (value as number).toFixed(1),
      },
    ],
    [handleTeamClick]
  );

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

  if (isLoading) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading teams...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.lg">
        <VStack gap={6} align="stretch">
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
              Teams
            </Heading>
          </HStack>

          {/* Filters */}
          <HStack gap={4} flexWrap="wrap">
            <Input
              placeholder="Search teams (min 3 chars)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              maxW="300px"
            />

            <SearchableSelect
              options={leagues}
              value={selectedLeague}
              onChange={setSelectedLeague}
              placeholder="Search leagues..."
              allLabel="All Leagues"
              width="220px"
            />
          </HStack>

          {/* Results info */}
          <Text color="fg.muted" fontSize="sm">
            Showing {paginatedTeams.length} of {filteredAndSortedTeams.length} teams
            {searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_LENGTH && (
              <Text as="span" color="orange.500" ml={2}>
                (type {MIN_SEARCH_LENGTH - searchQuery.length} more chars to search)
              </Text>
            )}
          </Text>

          {/* Table */}
          {filteredAndSortedTeams.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No teams found. Import players first or adjust your filters.
            </Text>
          ) : (
            <Table
              data={paginatedTeams}
              columns={columns}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />
          )}

          {/* Pagination */}
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

              <HStack gap={1}>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={currentPage === pageNum ? "solid" : "outline"}
                      colorPalette={currentPage === pageNum ? "glaucous" : undefined}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </HStack>

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
        </VStack>
      </Container>
    </Box>
  );
}
