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
  NativeSelect,
  Checkbox,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback, useTransition, useRef } from "react";
import { Link } from "react-router-dom";
import { db } from "../services/db";
import { useCompare } from "../contexts/CompareContext";
import { useRoster } from "../contexts/SnapshotContext";
import { RosterErrorNotice } from "../components/RosterErrorNotice";
import type { Player, LeagueRanking } from "../types/types";
import { Table, type Column, type SortDirection } from "../components/ui/table";
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import {
  ROLE_CONFIG,
  STAT_LABELS,
  INVERTED_STATS,
} from "../roles";
import { formatWage, displayDate } from "../utils/utils";
import { MoneyInput } from "../components/MoneyInput";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useSnapshots } from "../contexts/SnapshotContext";
import { resolveHorizon } from "../utils/planner";
import { loadWorkingState, saveWorkingState } from "../utils/scouting-filters";
import type { Brief, ColumnFilters, ContractHorizon, ScoutingFilters, Side } from "../types/briefs";
import { BriefPicker } from "../components/BriefPicker";
import { ShortlistPin } from "../components/ShortlistPin";
import { linkedListOf } from "../utils/briefs";
import { useBriefs } from "../contexts/BriefContext";

import { STAT_ABBREVIATIONS, GROUP_ABBREVIATIONS, roleClassFor } from "../utils/scouting-columns";
import { getStatGroupsForRole } from "../utils/stat-group-mapping";
import { groupTooltip } from "../components/GroupTooltip";
import {
  buildScoutingCohort,
  computeScoutingData,
  type ScoutingRow,
} from "../utils/scouting-engine";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const CONTRACT_OPTIONS: { value: ContractHorizon | ""; label: string }[] = [
  { value: "", label: "Any contract" },
  { value: "season", label: "By end of season" },
  { value: "1y", label: "Within a year" },
  { value: "2y", label: "Within two years" },
];

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
          aria-label={`Filter ${colKey}`}
        >
          f
        </Button>
      </ChakraPopover.Trigger>
      <ChakraPopover.Positioner>
        <ChakraPopover.Content w="auto" p={2}>
          <ChakraPopover.Body p={0}>
            <VStack gap={1.5} align="stretch" w="100px">
              {colKey === "wage" ? (
                <>
                  <MoneyInput
                    size="xs"
                    placeholder="min"
                    value={minVal === "" ? undefined : Number(minVal)}
                    onChange={(amount) => onChange(colKey, "min", amount === undefined ? "" : String(amount))}
                  />
                  <MoneyInput
                    size="xs"
                    placeholder="max"
                    value={maxVal === "" ? undefined : Number(maxVal)}
                    onChange={(amount) => onChange(colKey, "max", amount === undefined ? "" : String(amount))}
                  />
                </>
              ) : (
                <>
                  <Input
                    size="xs"
                    placeholder="min"
                    value={minVal}
                    onChange={(e) => onChange(colKey, "min", e.target.value)}
                    type="number"
                  />
                  <Input
                    size="xs"
                    placeholder="max"
                    value={maxVal}
                    onChange={(e) => onChange(colKey, "max", e.target.value)}
                    type="number"
                  />
                </>
              )}
            </VStack>
          </ChakraPopover.Body>
        </ChakraPopover.Content>
      </ChakraPopover.Positioner>
    </ChakraPopover.Root>
  );
}

export function ScoutingView() {
  const { players: rosterPlayers, error: rosterError } = useRoster();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [leagueRankings, setLeagueRankings] = useState<LeagueRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { compareList, addPlayer, removePlayer } = useCompare();
  const compareSet = useMemo(() => new Set(compareList), [compareList]);
  const { isUnwanted, lists, isLoaded: notesLoaded, loadError: notesError } = usePlayerNotes();

  const { active: activeSnapshot } = useSnapshots();
  const snapshotDate = activeSnapshot?.date ?? null;

  const [{ filters: saved, activeBriefId: savedBriefId }] = useState(loadWorkingState);
  const [activeBriefId, setActiveBriefId] = useState<string | null>(savedBriefId);
  const { briefs, isLoaded: briefsLoaded } = useBriefs();

  const [roleKey, setRoleKey] = useState(saved.roleKey);
  const [side, setSide] = useState<Side>(saved.side);

  const [contractHorizon, setContractHorizon] = useState<ContractHorizon | null>(saved.contractHorizon);
  const contractBefore = useMemo(
    () => resolveHorizon(snapshotDate, contractHorizon),
    [snapshotDate, contractHorizon]
  );
  const [columnFiltersRaw, setColumnFiltersRaw] = useState<ColumnFilters>(saved.columnFilters);
  const columnFilters = useDebouncedValue(columnFiltersRaw, DEBOUNCE_MS);
  const [excludeInjuries, setExcludeInjuries] = useState(saved.excludeInjuries);
  const [excludedLeagues, setExcludedLeagues] = useState<Set<string>>(new Set(saved.excludedLeagues));
  const [hideUnwanted, setHideUnwanted] = useState(false);
  const activeBrief = briefs.find((a) => a.id === activeBriefId) ?? null;
  const linkedList = linkedListOf(activeBrief, lists, notesLoaded && !notesError);
  const linkedListId = linkedList?.id ?? null;
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const shortlistKey = `${activeBriefId}|${linkedListId}`;
  const [shortlistKeySeen, setShortlistKeySeen] = useState(shortlistKey);
  if (shortlistKeySeen !== shortlistKey) {
    setShortlistKeySeen(shortlistKey);
    setShortlistOnly(false);
  }
  const shortlistUids = shortlistOnly ? linkedList?.uids : undefined;

  const [sortKey, setSortKey] = useState<keyof ScoutingRow>(saved.sortKey as keyof ScoutingRow);
  const [sortDirection, setSortDirection] = useState<SortDirection>(saved.sortDirection);
  const [currentPage, setCurrentPage] = useState(1);

  const [scoutingData, setScoutingData] = useState<ScoutingRow[]>([]);
  const [cohortSize, setCohortSize] = useState(0);
  const [isPending, startTransition] = useTransition();

  const currentFilters = useMemo<ScoutingFilters>(
    () => ({
      roleKey,
      side,
      columnFilters: columnFiltersRaw,
      contractHorizon,
      excludeInjuries,
      excludedLeagues: Array.from(excludedLeagues),
      sortKey: sortKey as string,
      sortDirection,
    }),
    [roleKey, side, columnFiltersRaw, contractHorizon, excludeInjuries, excludedLeagues, sortKey, sortDirection]
  );

  const roleIndex = Math.max(0, ROLE_CONFIG.findIndex((rc) => rc.key === roleKey));
  const roleConfig = ROLE_CONFIG[roleIndex];
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
      const RoleClass = roleClassFor(roleConfig, side);
      const cohort = buildScoutingCohort(allPlayers, RoleClass, leagueRankings);
      setCohortSize(cohort.length);
      const data = computeScoutingData(cohort, roleConfig, statGroups);
      setScoutingData(data);
    });
  }, [allPlayers, leagueRankings, roleConfig, side, statGroups]);

  useEffect(() => {
    saveWorkingState({ filters: currentFilters, activeBriefId });
  }, [currentFilters, activeBriefId]);

  useEffect(() => {
    if (briefsLoaded && activeBriefId && !briefs.some((a) => a.id === activeBriefId)) {
      setActiveBriefId(null);
    }
  }, [briefsLoaded, briefs, activeBriefId]);

  const applyBrief = useCallback((brief: Brief) => {
    const f = brief.filters;
    setRoleKey(f.roleKey);
    setSide(f.side);
    setColumnFiltersRaw(f.columnFilters);
    setContractHorizon(f.contractHorizon);
    setExcludeInjuries(f.excludeInjuries);
    setExcludedLeagues(new Set(f.excludedLeagues));
    setSortKey(f.sortKey as keyof ScoutingRow);
    setSortDirection(f.sortDirection);
    setActiveBriefId(brief.id);
    setCurrentPage(1);
  }, []);

  const hasRankedLeague = leagueRankings.some((r) => r.rank < 999);

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
      result = result.filter((r) => r.contractExpires && r.contractExpires <= contractBefore);
    }
    if (excludedLeagues.size > 0) {
      result = result.filter((r) => !excludedLeagues.has(r.division));
    }

    if (hideUnwanted) {
      result = result.filter((r) => !isUnwanted(r.uid));
    }

    if (shortlistUids) {
      const pinned = new Set(shortlistUids);
      result = result.filter((r) => pinned.has(r.uid));
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
  }, [scoutingData, excludeInjuries, columnFilters, contractBefore, excludedLeagues, sortKey, sortDirection, hideUnwanted, isUnwanted, shortlistUids]);

  const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [roleKey, side, columnFilters, contractBefore, excludeInjuries, excludedLeagues, sortKey, sortDirection, hideUnwanted, shortlistOnly]);

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
    setContractHorizon(null);
    setColumnFiltersRaw({});
    setExcludeInjuries(true);
    setExcludedLeagues(new Set());
    setActiveBriefId(null);
  }, []);

  const hasActiveFilters = activeBriefId !== null ||
    contractHorizon !== null ||
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
        width: linkedListId ? "84px" : "56px",
        render: (_value, row) =>
          linkedListId ? (
            <HStack gap={1}>
              <PlayerStatusControl uid={row.uid} player={{ Name: row.name, Club: row.club }} />
              <ShortlistPin listId={linkedListId} uid={row.uid} player={{ Name: row.name, Club: row.club }} />
            </HStack>
          ) : (
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
        headerTooltip: groupTooltip(group),
        render: (_v, row) => (
          <PercentileCell value={row.groupRatings[group.key]} />
        ),
        highlighted: true,
      });
    }

    return base;
  }, [roleConfig.statKeys, roleConfig.derivedPercentileStats, statGroups, compareSet, addPlayer, removePlayer, linkedListId]);

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

  if (rosterError) return <RosterErrorNotice error={rosterError} />;

  if (isLoading) {
    return (
      <Box p={4}>
        <Container>
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
        <Container>
          <Box p={4} borderRadius="md" bg="red.500" color="white">
            <Text fontWeight="medium">{error}</Text>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Container>
        <VStack gap={3} align="stretch">
          <HStack gap={2} flexWrap="wrap">
            {ROLE_CONFIG.map((rc, i) => (
              <Button
                key={rc.key}
                size="sm"
                variant={roleIndex === i ? "solid" : "outline"}
                colorPalette={roleIndex === i ? "glaucous" : undefined}
                onClick={() => { setRoleKey(rc.key); setSide("both"); setActiveBriefId(null); }}
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
                    onClick={() => {
                      if (s === side) return;
                      setSide(s);
                      setActiveBriefId(null);
                    }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </>
            )}
            <Box ml="auto">
              <BriefPicker
                filters={currentFilters}
                activeId={activeBriefId}
                onApply={applyBrief}
                onActiveChange={setActiveBriefId}
                shortlistOnly={shortlistOnly}
                onShortlistOnlyChange={setShortlistOnly}
              />
            </Box>
          </HStack>

          <HStack gap={3} flexWrap="wrap" align="center">
            <HStack gap={1}>
              <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">Contract expires:</Text>
              <NativeSelect.Root size="sm" width="170px" disabled={!snapshotDate}>
                <NativeSelect.Field
                  aria-label="Contract expires"
                  value={contractHorizon ?? ""}
                  onChange={(e) => setContractHorizon((e.currentTarget.value || null) as ContractHorizon | null)}
                >
                  {CONTRACT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
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
                {hasRankedLeague ? (
                  "No players of this role in ranked leagues with 900+ minutes."
                ) : (
                  <>
                    No leagues are ranked yet. Scouting only compares players in ranked leagues — rank
                    them on{" "}
                    <Link to="/leagues">
                      <Text as="span" color="glaucous.400" _hover={{ textDecoration: "underline" }}>
                        Leagues
                      </Text>
                    </Link>
                    .
                  </>
                )}
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
