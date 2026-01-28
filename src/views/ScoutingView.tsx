import {
  Container,
  VStack,
  Box,
  Text,
  Spinner,
  HStack,
  Button,
  Input,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback, useTransition, useRef } from "react";
import { Link } from "react-router-dom";
import { db } from "../services/db";
import type { Player, LeagueRanking } from "../types/types";
import { Table, type Column, type SortDirection } from "../components/ui/table";
import {
  ROLE_CONFIG,
  STAT_LABELS,
  INVERTED_STATS,
  LeftFullback,
  RightFullback,
  LeftWinger,
  RightWinger,
  type RoleConfig,
} from "../roles";
import { formatWage, displayDate } from "../utils/utils";

const STAT_ABBREVIATIONS: Record<string, string> = {
  saveRatio: "SR",
  expectedSaveRatio: "xSR",
  saveRatioOverExpected: "SR+",
  goalsPrevented: "GP",
  savesHeldRatio: "SH",
  passRatio: "PR",
  progressivePasses: "PP",
  keyPasses: "KP",
  tackles: "Tkl",
  tackleRatio: "TR",
  pressuresSuccessful: "Prs",
  headersWonRatio: "HW",
  aerialAttempts: "AA",
  keyHeaders: "KH",
  crossRatio: "CR",
  crossesSuccessful: "Crs",
  xA: "xA",
  chancesCreated: "CC",
  dribbles: "Drb",
  sprints: "Spr",
  npxG: "xG",
  conversionRatio: "Cv",
  goals: "Gls",
  xGOverperformance: "xG+",
  shots: "Sh",
  ballRetention: "BR",
  mistakes: "Mst",
  distance: "Dst",
};

const GROUP_ABBREVIATIONS: Record<string, string> = {
  goalkeeper: "GK",
  passing: "Pas",
  error: "Err",
  defensive: "Def",
  aerial: "Aer",
  possession: "Pos",
  physical: "Phy",
  creative: "Cre",
  movement: "Mov",
  attacking: "Att",
};
import { getStatGroupsForRole } from "../utils/stat-group-mapping";
import {
  buildScoutingCohort,
  computeScoutingData,
  type ScoutingRow,
} from "../utils/scouting-engine";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type Side = "both" | "left" | "right";

function getPercentileColor(value: number): string {
  if (value < 30) return "red.500";
  if (value < 60) return "yellow.500";
  return "green.500";
}

function PercentileCell({ value, inverted }: { value: number; inverted?: boolean }) {
  const display = inverted ? 100 - value : value;
  const rounded = Math.round(display);
  return (
    <Text color={getPercentileColor(display)} fontWeight="medium" fontSize="sm">
      {rounded}
    </Text>
  );
}

function getRoleClassForSide(config: RoleConfig, side: Side): RoleConfig["RoleClass"] {
  if (side === "both") return config.RoleClass;
  if (config.key === "FB") return side === "left" ? LeftFullback : RightFullback;
  if (config.key === "W") return side === "left" ? LeftWinger : RightWinger;
  return config.RoleClass;
}

interface LeagueMultiSelectProps {
  leagues: string[];
  excluded: Set<string>;
  onToggle: (league: string) => void;
}

function LeagueMultiSelect({ leagues, excluded, onToggle }: LeagueMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedCount = leagues.length - excluded.size;
  const label = excluded.size === 0 ? "All leagues" : `${selectedCount}/${leagues.length} leagues`;

  return (
    <Box position="relative" ref={ref}>
      <Box
        px={3}
        py={1}
        borderWidth="1px"
        borderRadius="md"
        cursor="pointer"
        bg="bg.subtle"
        onClick={() => setIsOpen(!isOpen)}
        _hover={{ borderColor: "fg.muted" }}
        whiteSpace="nowrap"
      >
        <Text fontSize="sm">{label}</Text>
      </Box>
      {isOpen && (
        <VStack
          position="absolute"
          top="100%"
          left={0}
          mt={1}
          bg="bg.panel"
          borderWidth="1px"
          borderRadius="md"
          boxShadow="lg"
          zIndex={10}
          align="stretch"
          gap={0}
          minW="200px"
          maxH="240px"
          overflowY="auto"
        >
          {leagues.map((league) => (
            <HStack
              key={league}
              px={3}
              py={1}
              cursor="pointer"
              _hover={{ bg: "bg.subtle" }}
              onClick={() => onToggle(league)}
              gap={2}
            >
              <input
                type="checkbox"
                checked={!excluded.has(league)}
                readOnly
              />
              <Text fontSize="sm" truncate>{league}</Text>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}

export function ScoutingView() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [leagueRankings, setLeagueRankings] = useState<LeagueRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [side, setSide] = useState<Side>("both");

  const [wageMinRaw, setWageMin] = useState("");
  const [wageMaxRaw, setWageMax] = useState("");
  const [contractBeforeRaw, setContractBefore] = useState("");
  const wageMin = useDebouncedValue(wageMinRaw, DEBOUNCE_MS);
  const wageMax = useDebouncedValue(wageMaxRaw, DEBOUNCE_MS);
  const contractBefore = useDebouncedValue(contractBeforeRaw, DEBOUNCE_MS);
  const [excludeInjuries, setExcludeInjuries] = useState(true);
  const [excludedLeagues, setExcludedLeagues] = useState<Set<string>>(new Set());

  const [sortKey, setSortKey] = useState<keyof ScoutingRow>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const [scoutingData, setScoutingData] = useState<ScoutingRow[]>([]);
  const [cohortSize, setCohortSize] = useState(0);
  const [isPending, startTransition] = useTransition();

  const roleConfig = ROLE_CONFIG[selectedRoleIndex];
  const hasSideSelector = roleConfig.key === "FB" || roleConfig.key === "W";
  const statGroups = useMemo(() => getStatGroupsForRole(roleConfig.key), [roleConfig.key]);

  useEffect(() => {
    async function loadData() {
      try {
        const [players, rankings] = await Promise.all([
          db.getAllPlayers(),
          db.getLeagueRankings(),
        ]);
        setAllPlayers(players);
        setLeagueRankings(rankings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (allPlayers.length === 0 || leagueRankings.length === 0) return;

    startTransition(() => {
      const RoleClass = getRoleClassForSide(roleConfig, side);
      const cohort = buildScoutingCohort(allPlayers, RoleClass, leagueRankings);
      setCohortSize(cohort.length);
      const data = computeScoutingData(cohort, roleConfig, statGroups);
      setScoutingData(data);
    });
  }, [allPlayers, leagueRankings, roleConfig, side, statGroups]);

  const availableLeagues = useMemo(() => {
    const leagues = new Set<string>();
    for (const row of scoutingData) {
      leagues.add(row.division);
    }
    return Array.from(leagues).sort();
  }, [scoutingData]);

  const filteredAndSorted = useMemo(() => {
    let result = scoutingData;

    if (excludeInjuries) {
      result = result.filter((r) => !r.injuries);
    }
    if (wageMin) {
      const min = Number(wageMin);
      if (!isNaN(min)) result = result.filter((r) => r.wage >= min);
    }
    if (wageMax) {
      const max = Number(wageMax);
      if (!isNaN(max)) result = result.filter((r) => r.wage <= max);
    }
    if (contractBefore) {
      const before = new Date(contractBefore);
      result = result.filter((r) => r.contractExpires && r.contractExpires <= before);
    }
    if (excludedLeagues.size > 0) {
      result = result.filter((r) => !excludedLeagues.has(r.division));
    }

    return [...result].sort((a, b) => {
      const key = sortKey as string;
      let aVal: unknown;
      let bVal: unknown;

      if (key.startsWith("stat_")) {
        const statKey = key.slice(5);
        aVal = a.statPercentiles[statKey];
        bVal = b.statPercentiles[statKey];
      } else if (key.startsWith("group_")) {
        const groupKey = key.slice(6);
        aVal = a.groupRatings[groupKey];
        bVal = b.groupRatings[groupKey];
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (aVal instanceof Date && bVal instanceof Date) {
        return sortDirection === "asc"
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
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
  }, [scoutingData, excludeInjuries, wageMin, wageMax, contractBefore, excludedLeagues, sortKey, sortDirection]);

  const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRoleIndex, side, wageMin, wageMax, contractBefore, excludeInjuries, excludedLeagues, sortKey, sortDirection]);

  useEffect(() => {
    setSide("both");
  }, [selectedRoleIndex]);

  const handleSortChange = useCallback(
    (key: keyof ScoutingRow, direction: SortDirection) => {
      setSortKey(key);
      setSortDirection(direction);
    },
    []
  );

  const toggleLeague = useCallback((league: string) => {
    setExcludedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(league)) {
        next.delete(league);
      } else {
        next.add(league);
      }
      return next;
    });
  }, []);

  const columns: Column<ScoutingRow>[] = useMemo(() => {
    const base: Column<ScoutingRow>[] = [
      {
        key: "name",
        header: "Name",
        render: (_v, row) => (
          <Link to={`/players/${row.uid}`}>
            <Text color="glaucous.400" _hover={{ textDecoration: "underline" }} fontSize="sm">
              {row.name}
            </Text>
          </Link>
        ),
      },
      { key: "age", header: "Age" },
      { key: "club", header: "Club", sortable: false },
      { key: "division", header: "Division" },
      { key: "wage", header: "Wage", render: (v) => formatWage(v as number) },
      {
        key: "contractExpires",
        header: "Contract",
        render: (v) => (v ? displayDate(v as Date) : "-"),
      },
    ];

    for (const statKey of roleConfig.statKeys) {
      const inverted = INVERTED_STATS.has(statKey);
      base.push({
        key: `stat_${statKey}` as keyof ScoutingRow,
        header: STAT_ABBREVIATIONS[statKey] ?? statKey,
        headerTooltip: STAT_LABELS[statKey] ?? statKey,
        render: (_v, row) => (
          <PercentileCell
            value={row.statPercentiles[statKey]}
            inverted={inverted}
          />
        ),
      });
    }

    for (const group of statGroups) {
      base.push({
        key: `group_${group.key}` as keyof ScoutingRow,
        header: GROUP_ABBREVIATIONS[group.key] ?? group.key,
        headerTooltip: group.label,
        render: (_v, row) => (
          <PercentileCell value={row.groupRatings[group.key]} />
        ),
        highlighted: true,
      });
    }

    return base;
  }, [roleConfig.statKeys, statGroups]);

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

  if (error) {
    return (
      <Box p={4}>
        <Container maxW="container.xl">
          <Box p={4} borderRadius="md" bg="red.500" color="white">
            <Text fontWeight="medium">{error}</Text>
          </Box>
        </Container>
      </Box>
    );
  }

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

          <HStack gap={3} flexWrap="wrap" align="center">
            <Input
              placeholder="Min wage"
              value={wageMinRaw}
              onChange={(e) => setWageMin(e.target.value)}
              maxW="110px"
              size="sm"
              type="number"
            />
            <Input
              placeholder="Max wage"
              value={wageMaxRaw}
              onChange={(e) => setWageMax(e.target.value)}
              maxW="110px"
              size="sm"
              type="number"
            />
            <HStack gap={1}>
              <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">Contract before:</Text>
              <Input
                type="date"
                value={contractBeforeRaw}
                onChange={(e) => setContractBefore(e.target.value)}
                maxW="150px"
                size="sm"
              />
            </HStack>
            <HStack gap={1} as="label" cursor="pointer">
              <input
                type="checkbox"
                checked={excludeInjuries}
                onChange={(e) => setExcludeInjuries(e.target.checked)}
              />
              <Text fontSize="sm">Exclude injuries</Text>
            </HStack>
            {availableLeagues.length > 0 && (
              <LeagueMultiSelect
                leagues={availableLeagues}
                excluded={excludedLeagues}
                onToggle={toggleLeague}
              />
            )}
            <Text color="fg.muted" fontSize="sm" ml="auto">
              {filteredAndSorted.length}/{cohortSize} players
              {cohortSize > 0 && ` (vs ${cohortSize})`}
            </Text>
          </HStack>

          <Box position="relative" opacity={isPending ? 0.5 : 1} transition="opacity 0.2s">
            {isPending && (
              <Box
                position="absolute"
                inset={0}
                display="flex"
                alignItems="center"
                justifyContent="center"
                zIndex={1}
              >
                <Spinner size="lg" colorPalette="glaucous" />
              </Box>
            )}
            {scoutingData.length === 0 && !isPending ? (
              <Text color="fg.muted" textAlign="center">
                No players found for this role. Import data and set up league rankings first.
              </Text>
            ) : (
              <>
                <Table<ScoutingRow>
                  data={paginatedData}
                  columns={columns}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />

                {totalPages > 1 && (
                  <HStack justify="center" gap={2} mt={3}>
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
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
