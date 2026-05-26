import {
  Container,
  Heading,
  VStack,
  Box,
  Text,
  Spinner,
  HStack,
  Button,
  Input,
  NativeSelect,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../services/db";
import type { Player } from "../types/types";
import { Table, type Column, type SortDirection } from "../components/ui/table";
import { formatWage, displayDate, formatPositions, getEffectivePosition } from "../utils/utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 20;
const MIN_SEARCH_LENGTH = 3;
const POSITION_TYPES = ["GK", "D", "WB", "DM", "M", "AM", "ST"] as const;

interface PlayerRow extends Record<string, unknown> {
  name: string;
  age: number;
  position: string;
  positionTypes: string[];
  club: string;
  starts: number;
  minutes: number;
  nat: string;
  wage: number;
  injuries: boolean;
  contractExpires: Date | null;
  uid: number;
}

const columns: Column<PlayerRow>[] = [
  { key: "name", header: "Name" },
  { key: "age", header: "Age" },
  { key: "position", header: "Position" },
  { key: "club", header: "Club" },
  { key: "starts", header: "Starts" },
  { key: "minutes", header: "Minutes" },
  { key: "nat", header: "Nat" },
  { key: "wage", header: "Wage", render: (v) => formatWage(v as number) },
  {
    key: "injuries",
    header: "Rc. Injuries",
    render: (v) => (v ? String(v) : "-"),
  },
  {
    key: "contractExpires",
    header: "Contract Expires",
    render: (v) => (v ? displayDate(v as Date) : "-"),
  },
];

export function PlayersView() {
  useDocumentTitle("Players");
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof PlayerRow>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [selectedClub, setSelectedClub] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const allPlayers = await db.getAllPlayers();
        setPlayers(allPlayers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load players");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const clubs = useMemo(() => {
    const clubSet = new Set<string>();
    for (const player of players) {
      if (player.Club) {
        clubSet.add(player.Club);
      }
    }
    return Array.from(clubSet).sort();
  }, [players]);

  const data: PlayerRow[] = useMemo(
    () =>
      players.map((p) => ({
        name: p.Name,
        age: p.Age,
        position: formatPositions(getEffectivePosition(p)),
        positionTypes: getEffectivePosition(p).map((pos) => pos.type),
        club: p.Club,
        starts: p.Starts,
        minutes: p.Mins,
        nat: p.Nat,
        wage: p.Wage,
        injuries: p.RcInjury,
        contractExpires: p.Expires,
        uid: p.UID,
      })),
    [players]
  );

  const filteredAndSortedData = useMemo(() => {
    let result = data;

    if (searchQuery.length >= MIN_SEARCH_LENGTH) {
      const lowerSearch = searchQuery.toLowerCase();
      result = result.filter((player) =>
        player.name.toLowerCase().includes(lowerSearch)
      );
    }

    if (selectedPositions.size > 0) {
      result = result.filter((player) =>
        player.positionTypes.some((type) => selectedPositions.has(type))
      );
    }

    if (selectedClub) {
      result = result.filter((player) => player.club === selectedClub);
    }

    return [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === "asc"
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        const aNum = aVal ? 1 : 0;
        const bNum = bVal ? 1 : 0;
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

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
  }, [data, searchQuery, selectedPositions, selectedClub, sortKey, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedData.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPositions, selectedClub, sortKey, sortDirection]);

  const handleSortChange = useCallback(
    (key: keyof PlayerRow, direction: SortDirection) => {
      setSortKey(key);
      setSortDirection(direction);
    },
    []
  );

  const handleRowClick = useCallback(
    (row: PlayerRow) => {
      navigate(`/players/${row.uid}`);
    },
    [navigate]
  );

  const togglePosition = useCallback((position: string) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(position)) {
        next.delete(position);
      } else {
        next.add(position);
      }
      return next;
    });
  }, []);

  const clearPositionFilter = useCallback(() => {
    setSelectedPositions(new Set());
  }, []);

  if (isLoading) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.xl">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading players...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.xl">
          <VStack gap={4}>
            <Box p={4} borderRadius="md" bg="red.500" color="white">
              <Text fontWeight="medium">{error}</Text>
            </Box>
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.xl">
        <VStack gap={6} align="stretch">
          <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
            Players
          </Heading>

          <VStack gap={4} align="stretch">
            <HStack gap={4} flexWrap="wrap">
              <Input
                placeholder="Search by name (min 3 chars)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                maxW="300px"
              />

              <NativeSelect.Root size="sm" width="200px">
                <NativeSelect.Field
                  value={selectedClub}
                  onChange={(e) => setSelectedClub(e.target.value)}
                >
                  <option value="">All Clubs</option>
                  {clubs.map((club) => (
                    <option key={club} value={club}>
                      {club}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>

            <HStack gap={2} flexWrap="wrap" align="center">
              <Text color="fg.muted" fontSize="sm" minW="60px">
                Position:
              </Text>
              {POSITION_TYPES.map((pos) => (
                <Button
                  key={pos}
                  size="xs"
                  variant={selectedPositions.has(pos) ? "solid" : "outline"}
                  colorPalette={selectedPositions.has(pos) ? "glaucous" : undefined}
                  onClick={() => togglePosition(pos)}
                >
                  {pos}
                </Button>
              ))}
              {selectedPositions.size > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  color="fg.muted"
                  onClick={clearPositionFilter}
                >
                  Clear
                </Button>
              )}
            </HStack>
          </VStack>

          <Text color="fg.muted" fontSize="sm">
            Showing {paginatedData.length} of {filteredAndSortedData.length} players
            {searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_LENGTH && (
              <Text as="span" color="orange.500" ml={2}>
                (type {MIN_SEARCH_LENGTH - searchQuery.length} more chars to search)
              </Text>
            )}
          </Text>

          {players.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No players found. Import data first.
            </Text>
          ) : filteredAndSortedData.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No players match the current filters.
            </Text>
          ) : (
            <>
              <PlayersTable
                data={paginatedData}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
                onRowClick={handleRowClick}
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
            </>
          )}
        </VStack>
      </Container>
    </Box>
  );
}

interface PlayersTableProps {
  data: PlayerRow[];
  sortKey: keyof PlayerRow;
  sortDirection: SortDirection;
  onSortChange: (key: keyof PlayerRow, direction: SortDirection) => void;
  onRowClick: (row: PlayerRow) => void;
}

function PlayersTable({
  data,
  sortKey,
  sortDirection,
  onSortChange,
  onRowClick,
}: PlayersTableProps) {
  return (
    <Table<PlayerRow>
      data={data}
      columns={columns}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={onSortChange}
      onRowClick={onRowClick}
    />
  );
}
