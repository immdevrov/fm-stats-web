import {
  Container,
  VStack,
  Box,
  Text,
  Spinner,
  HStack,
  Button,
  Input,
  Table as CTable,
  Popover as ChakraPopover,
  Checkbox,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback, useTransition, useRef } from "react";
import { Link } from "react-router-dom";
import { db } from "../services/db";
import { useCompare } from "../contexts/CompareContext";
import { useRoster } from "../contexts/SnapshotContext";
import type { Player, LeagueRanking } from "../types/types";
import { Table, type Column, type SortDirection } from "../components/ui/table";
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
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
import { formatWage, displayDate, parseCustomDate } from "../utils/utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const STAT_ABBREVIATIONS: Record<string, string> = {
  saveRatio: "SR",
  expectedSaveRatio: "xSR",
  saveRatioOverExpected: "SR+",
  goalsPrevented: "GP",
  savesHeldRatio: "SH",
  concededPer90: "Con",
  savesPer90: "Sv",
  shotStoppingRank: "SSR",
  passRatio: "PR",
  progressivePasses: "PP",
  keyPasses: "KP",
  tackles: "Tkl",
  tackleRatio: "TR",
  pressuresSuccessful: "Pr%",
  defensiveContributions: "DC",
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
const STORAGE_KEY = "scouting-filters";

interface SavedFilters {
  selectedRoleIndex: number;
  side: Side;
  contractBefore: string;
  columnFilters: Record<string, { min?: string; max?: string }>;
  excludeInjuries: boolean;
  excludedLeagues: string[];
  sortKey: string;
  sortDirection: SortDirection;
}

function loadFilters(): Partial<SavedFilters> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveFilters(filters: SavedFilters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch { /* ignore */ }
}

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

function ColumnFilterPopover({
  colKey,
  minVal,
  maxVal,
  onChange,
}: {
  colKey: string;
  minVal: string;
  maxVal: string;
  onChange: (key: string, field: "min" | "max", value: string) => void;
}) {
  const hasFilter = minVal !== "" || maxVal !== "";

  return (
    <ChakraPopover.Root positioning={{ placement: "bottom" }}>
      <ChakraPopover.Trigger asChild>
        <Button
          size="xs"
          variant={hasFilter ? "solid" : "outline"}
          colorPalette={hasFilter ? "glaucous" : undefined}
          px={1}
          minW="20px"
          h="20px"
          fontSize="xs"
        >
          f
        </Button>
      </ChakraPopover.Trigger>
      <ChakraPopover.Positioner>
        <ChakraPopover.Content w="auto" p={2}>
          <ChakraPopover.Body p={0}>
            <VStack gap={1.5} align="stretch">
              <Input
                size="xs"
                placeholder="min"
                value={minVal}
                onChange={(e) => onChange(colKey, "min", e.target.value)}
                type="number"
                w="100px"
              />
              <Input
                size="xs"
                placeholder="max"
                value={maxVal}
                onChange={(e) => onChange(colKey, "max", e.target.value)}
                type="number"
                w="100px"
              />
            </VStack>
          </ChakraPopover.Body>
        </ChakraPopover.Content>
      </ChakraPopover.Positioner>
    </ChakraPopover.Root>
  );
}

export function ScoutingView() {
  const { players: rosterPlayers } = useRoster();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [leagueRankings, setLeagueRankings] = useState<LeagueRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { compareList, addPlayer, removePlayer } = useCompare();
  const compareSet = useMemo(() => new Set(compareList), [compareList]);
  const { isUnwanted } = usePlayerNotes();

  const [saved] = useState(loadFilters);

  const [selectedRoleIndex, setSelectedRoleIndex] = useState(saved.selectedRoleIndex ?? 0);
  const [side, setSide] = useState<Side>(saved.side ?? "both");

  const [contractBeforeRaw, setContractBefore] = useState(saved.contractBefore ?? "");
  const contractBefore = useDebouncedValue(contractBeforeRaw, DEBOUNCE_MS);
  const [columnFiltersRaw, setColumnFiltersRaw] = useState<Record<string, { min?: string; max?: string }>>(saved.columnFilters ?? {});
  const columnFilters = useDebouncedValue(columnFiltersRaw, DEBOUNCE_MS);
  const [excludeInjuries, setExcludeInjuries] = useState(saved.excludeInjuries ?? true);
  const [excludedLeagues, setExcludedLeagues] = useState<Set<string>>(new Set(saved.excludedLeagues));
  const [hideUnwanted, setHideUnwanted] = useState(false);

  const [sortKey, setSortKey] = useState<keyof ScoutingRow>((saved.sortKey as keyof ScoutingRow) ?? "name");
  const [sortDirection, setSortDirection] = useState<SortDirection>(saved.sortDirection ?? "asc");
  const [currentPage, setCurrentPage] = useState(1);

  const [scoutingData, setScoutingData] = useState<ScoutingRow[]>([]);
  const [cohortSize, setCohortSize] = useState(0);
  const [isPending, startTransition] = useTransition();

  const roleConfig = ROLE_CONFIG[selectedRoleIndex];
  useDocumentTitle(`Scouting: ${roleConfig.name}`);
  const hasSideSelector = roleConfig.key === "FB" || roleConfig.key === "W";
  const statGroups = useMemo(() => getStatGroupsForRole(roleConfig.key), [roleConfig.key]);

  useEffect(() => {
    if (rosterPlayers === null) return;
    const roster: Player[] = rosterPlayers;
    async function loadData() {
      try {
        const rankings = await db.getLeagueRankings();
        setAllPlayers(roster);
        setLeagueRankings(rankings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [rosterPlayers]);

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

  useEffect(() => {
    saveFilters({
      selectedRoleIndex,
      side,
      contractBefore: contractBeforeRaw,
      columnFilters: columnFiltersRaw,
      excludeInjuries,
      excludedLeagues: Array.from(excludedLeagues),
      sortKey: sortKey as string,
      sortDirection,
    });
  }, [selectedRoleIndex, side, contractBeforeRaw, columnFiltersRaw, excludeInjuries, excludedLeagues, sortKey, sortDirection]);

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
    if (contractBefore) {
      const parts = contractBefore.split("/");
      const before = parts.length === 3 ? parseCustomDate(contractBefore) : null;
      if (before && !isNaN(before.getTime())) {
        result = result.filter((r) => r.contractExpires && r.contractExpires <= before);
      }
    }
    if (excludedLeagues.size > 0) {
      result = result.filter((r) => !excludedLeagues.has(r.division));
    }

    if (hideUnwanted) {
      result = result.filter((r) => !isUnwanted(r.uid));
    }

    for (const [key, bounds] of Object.entries(columnFilters)) {
      const min = bounds.min ? Number(bounds.min) : undefined;
      const max = bounds.max ? Number(bounds.max) : undefined;
      if (min === undefined && max === undefined) continue;

      result = result.filter((r) => {
        let val: number | undefined;
        if (key.startsWith("stat_")) {
          const statKey = key.slice(5);
          val = r.statPercentiles[statKey];
          if (val !== undefined && INVERTED_STATS.has(statKey)) val = 100 - val;
        } else if (key.startsWith("derived_")) {
          val = r.statPercentiles[key.slice(8)];
        } else if (key.startsWith("group_")) {
          val = r.groupRatings[key.slice(6)];
        } else if (key === "age") {
          val = r.age;
        } else if (key === "wage") {
          val = r.wage;
        }
        if (val === undefined) return true;
        if (min !== undefined && !isNaN(min) && val < min) return false;
        if (max !== undefined && !isNaN(max) && val > max) return false;
        return true;
      });
    }

    return [...result].sort((a, b) => {
      const key = sortKey as string;
      let aVal: unknown;
      let bVal: unknown;

      if (key.startsWith("stat_")) {
        const statKey = key.slice(5);
        aVal = a.statPercentiles[statKey];
        bVal = b.statPercentiles[statKey];
      } else if (key.startsWith("derived_")) {
        const derivedKey = key.slice(8);
        aVal = a.statPercentiles[derivedKey];
        bVal = b.statPercentiles[derivedKey];
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
  }, [scoutingData, excludeInjuries, columnFilters, contractBefore, excludedLeagues, sortKey, sortDirection, hideUnwanted, isUnwanted]);

  const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRoleIndex, side, columnFilters, contractBefore, excludeInjuries, excludedLeagues, sortKey, sortDirection, hideUnwanted]);

  const handleSortChange = useCallback(
    (key: keyof ScoutingRow, direction: SortDirection) => {
      setSortKey(key);
      setSortDirection(direction);
    },
    []
  );

  const setColumnFilter = useCallback((key: string, field: "min" | "max", value: string) => {
    setColumnFiltersRaw((prev) => {
      const entry = prev[key] ?? {};
      const updated = { ...entry, [field]: value };
      if (!updated.min && !updated.max) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: updated };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setContractBefore("");
    setColumnFiltersRaw({});
    setExcludeInjuries(true);
    setExcludedLeagues(new Set());
  }, []);

  const hasActiveFilters = contractBeforeRaw !== "" ||
    Object.keys(columnFiltersRaw).length > 0 ||
    !excludeInjuries ||
    excludedLeagues.size > 0;

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
        key: "uid",
        header: "",
        sortable: false,
        width: "56px",
        render: (_value, row) => (
          <PlayerStatusControl uid={row.uid} player={{ Name: row.name, Club: row.club }} />
        ),
      },
      {
        key: "name",
        header: "Name",
        render: (_v, row) => {
          const inCompare = compareSet.has(row.uid);
          return (
            <HStack gap={1}>
              <Link to={`/players/${row.uid}`}>
                <Text color="glaucous.400" _hover={{ textDecoration: "underline" }} fontSize="sm">
                  {row.name}
                </Text>
              </Link>
              <Button
                size="xs"
                variant={inCompare ? "solid" : "outline"}
                colorPalette={inCompare ? "glaucous" : undefined}
                px={1}
                minW="18px"
                h="18px"
                fontSize="2xs"
                onClick={(e) => {
                  e.stopPropagation();
                  if (inCompare) removePlayer(row.uid);
                  else addPlayer(row.uid);
                }}
              >
                vs
              </Button>
            </HStack>
          );
        },
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

    if (roleConfig.derivedPercentileStats) {
      for (const derived of roleConfig.derivedPercentileStats) {
        base.push({
          key: `derived_${derived.key}` as keyof ScoutingRow,
          header: STAT_ABBREVIATIONS[derived.key] ?? derived.key,
          headerTooltip: STAT_LABELS[derived.key] ?? derived.key,
          render: (_v, row) => (
            <PercentileCell value={row.statPercentiles[derived.key]} />
          ),
          highlighted: true,
        });
      }
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
  }, [roleConfig.statKeys, roleConfig.derivedPercentileStats, statGroups, compareSet, addPlayer, removePlayer]);

  const filterRow = useMemo(() => {
    const filterableKeys = new Set(["age", "wage"]);

    return (
      <CTable.Row bg="bg.subtle">
        {columns.map((col) => {
          const key = col.id ?? String(col.key);
          const isFilterable =
            filterableKeys.has(key) ||
            key.startsWith("stat_") ||
            key.startsWith("derived_") ||
            key.startsWith("group_");

          return (
            <CTable.Cell
              key={key}
              borderRightWidth="1px"
              borderColor="border.emphasized"
              p={1}
              textAlign="center"
            >
              {isFilterable ? (
                <ColumnFilterPopover
                  colKey={key}
                  minVal={columnFiltersRaw[key]?.min ?? ""}
                  maxVal={columnFiltersRaw[key]?.max ?? ""}
                  onChange={setColumnFilter}
                />
              ) : null}
            </CTable.Cell>
          );
        })}
      </CTable.Row>
    );
  }, [columns, columnFiltersRaw, setColumnFilter]);

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
                onClick={() => { setSelectedRoleIndex(i); setSide("both"); }}
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
            <HStack gap={1}>
              <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">Contract before:</Text>
              <Input
                type="text"
                placeholder="DD/MM/YYYY"
                value={contractBeforeRaw}
                onChange={(e) => setContractBefore(e.target.value)}
                maxW="130px"
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
            <Checkbox.Root
              checked={hideUnwanted}
              onCheckedChange={(e) => setHideUnwanted(e.checked === true)}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>Hide unwanted</Checkbox.Label>
            </Checkbox.Root>
            {availableLeagues.length > 0 && (
              <LeagueMultiSelect
                leagues={availableLeagues}
                excluded={excludedLeagues}
                onToggle={toggleLeague}
              />
            )}
            {hasActiveFilters && (
              <Button size="xs" variant="outline" colorPalette="spicyPaprika" onClick={clearFilters}>
                Clear filters
              </Button>
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
                  filterRow={filterRow}
                  rowProps={(row) => (isUnwanted(row.uid) ? { color: "fg.muted", bg: "bg.subtle" } : {})}
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
