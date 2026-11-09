import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Badge, Button, Checkbox, chakra, HStack, Table as ChakraTable, Text, VStack } from "@chakra-ui/react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { LuGripVertical } from "react-icons/lu";
import { useBriefs } from "../contexts/BriefContext";
import { Link } from "react-router-dom";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { PlayerStatusControl } from "./PlayerStatusControl";
import { groupTooltip } from "./GroupTooltip";
import { GradeControl, RemoveMenu, VerdictLine } from "./BriefPickControls";
import { Table, sortRows, type Column, type SortDirection, type TableRowProps } from "./ui/table";
import { Tooltip } from "./ui/tooltip";
import { dominance } from "../utils/dominance";
import { formatWage, displayDate } from "../utils/utils";
import {
  briefRoleConfig,
  buildBriefRows,
  heatKeys,
  thresholdText,
  type BriefRow,
  type HeatKey,
} from "../utils/brief-rows";
import type { Brief } from "../types/briefs";
import type { PlayerList } from "../types/annotations";
import type { Player, LeagueRanking } from "../types/types";

function heatBackground(value: number): string {
  const d = (value - 50) / 50;
  if (d === 0) return "transparent";
  const colour = d > 0 ? "green" : "red";
  return `color-mix(in oklab, var(--chakra-colors-${colour}-500) ${Math.round(Math.abs(d) * 60)}%, transparent)`;
}

function heatColumn(heat: HeatKey, subheader?: string): Column<BriefRow> {
  return {
    key: heat.key,
    header: heat.abbr,
    subheader,
    headerTooltip: heat.group ? groupTooltip(heat.group) : heat.label,
    highlighted: !heat.key.startsWith("stat_"),
    render: (value) => (value === null ? "" : String(Math.round(value as number))),
    cellProps: (row) => {
      const value = row[heat.key] as number | null;
      if (value === null) return {};
      return {
        bg: heatBackground(value),
        color: "fg.default",
        textAlign: "center",
        "aria-label": `${heat.label}: ${Math.round(value)}`,
      };
    },
  };
}

function DragGrip({ uid, name }: { uid: number; name: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: uid });
  return (
    <chakra.button
      type="button"
      ref={setNodeRef}
      aria-label={`Drag ${name}`}
      cursor="grab"
      touchAction="none"
      display="inline-flex"
      alignItems="center"
      color="fg.muted"
      mr={1}
      {...attributes}
      tabIndex={-1}
      {...listeners}
    >
      <LuGripVertical size={12} />
    </chakra.button>
  );
}

function BriefDragRow({ row, ...rest }: TableRowProps<BriefRow>) {
  const { setNodeRef, isOver } = useDroppable({ id: row.uid });
  const { active } = useDndContext();
  const dragging = active?.id === row.uid;
  return (
    <ChakraTable.Row
      {...rest}
      ref={setNodeRef}
      {...(dragging ? { opacity: 0.4 } : {})}
      {...(isOver && !dragging
        ? { outline: "2px solid", outlineColor: "glaucous.400", outlineOffset: "-2px" }
        : {})}
    />
  );
}

export function BriefHeatTable({
  brief,
  list,
  roster,
  rankings,
}: {
  brief: Brief;
  list: PlayerList;
  roster: Player[];
  rankings: LeagueRanking[];
}) {
  const { annotations } = usePlayerNotes();
  const { movePick } = useBriefs();
  const [allStats, setAllStats] = useState(false);
  const [chosenSortKey, setSortKey] = useState<keyof BriefRow>("index");
  const [chosenDirection, setSortDirection] = useState<SortDirection>("asc");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(
    () => buildBriefRows(brief, list, roster, rankings, annotations),
    [brief, list, roster, rankings, annotations]
  );

  const briefStatKeys = useMemo(
    () =>
      heatKeys(briefRoleConfig(brief))
        .filter((heat) => !heat.key.startsWith("group_"))
        .filter((heat) => thresholdText(brief.filters.columnFilters[heat.key]) !== null)
        .map((heat) => heat.key),
    [brief]
  );

  const [compareMode, setCompareMode] = useState(false);
  const [hoveredUid, setHoveredUid] = useState<number | null>(null);
  const [pinnedUid, setPinnedUid] = useState<number | null>(null);
  const dragging = useRef(false);
  const canCompare = briefStatKeys.length > 0;
  const pinned = pinnedUid !== null && rows.some((r) => r.uid === pinnedUid) ? pinnedUid : null;
  const focusUid = compareMode && canCompare ? (pinned ?? hoveredUid) : null;
  const focusRow = focusUid === null ? undefined : rows.find((r) => r.uid === focusUid);
  const outcome = useMemo(
    () => (focusUid === null ? null : dominance(rows, briefStatKeys, focusUid)),
    [rows, briefStatKeys, focusUid]
  );

  useEffect(() => {
    if (pinned === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if ((e.target as HTMLElement).closest?.("input, textarea, [role='menu'], [role='dialog']")) return;
      setPinnedUid(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned]);

  const onRowClick = (uid: number) => (e: MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (dragging.current || !e.currentTarget.contains(target)) return;
    if (target.closest("a, button, input, textarea")) return;
    setPinnedUid((current) => (current === uid ? null : uid));
  };

  const compareProps = (row: BriefRow) => {
    if (!compareMode || !canCompare) return {};
    const handlers = {
      onMouseEnter: () => {
        if (!dragging.current) setHoveredUid(row.uid);
      },
      onMouseLeave: () => setHoveredUid((current) => (current === row.uid ? null : current)),
      onClick: onRowClick(row.uid),
    };
    if (row.uid === focusUid) {
      return {
        ...handlers,
        "data-dominance": "focus",
        outline: "2px solid",
        outlineColor: "glaucous.400",
        outlineOffset: "-2px",
      };
    }
    if (outcome?.beats.has(row.uid)) return { ...handlers, "data-dominance": "beats", opacity: 0.3 };
    if (outcome?.beatenBy.has(row.uid)) {
      return {
        ...handlers,
        "data-dominance": "beaten-by",
        bg: "glaucous.500/25",
        _hover: { bg: "glaucous.500/35" },
        boxShadow: "inset 4px 0 0 var(--chakra-colors-glaucous-400)",
      };
    }
    return handlers;
  };

  const availableColumns = useMemo(() => {
    const { columnFilters } = brief.filters;
    const keys = heatKeys(briefRoleConfig(brief));
    const isBriefStat = (heat: HeatKey) => thresholdText(columnFilters[heat.key]) !== null;
    const isGroup = (heat: HeatKey) => heat.key.startsWith("group_");

    const base: Column<BriefRow>[] = [
      {
        key: "index",
        header: "#",
        firstSortDirection: "asc",
      },
      {
        key: "grade",
        header: "Grade",
        firstSortDirection: "asc",
        render: (_v, row) => <GradeControl brief={brief} list={list} row={row} />,
      },
      {
        key: "name",
        header: "Player",
        render: (_v, row) => (
          <VStack gap={0} align="stretch">
            <HStack gap={2} flexWrap="wrap">
              <PlayerStatusControl uid={row.uid} player={row.identity} />
              {row.absent ? (
                <Text fontSize="sm">{row.name}</Text>
              ) : (
                <Link to={`/players/${row.uid}`}>
                  <Text color="glaucous.400" _hover={{ textDecoration: "underline" }} fontSize="sm">
                    {row.name}
                  </Text>
                </Link>
              )}
              {row.tags.map((tag) => (
                <Badge key={tag} size="sm" variant="outline">
                  {tag}
                </Badge>
              ))}
              <RemoveMenu list={list} row={row} />
            </HStack>
            <VerdictLine brief={brief} list={list} row={row} />
          </VStack>
        ),
      },
      { key: "age", header: "Age" },
      { key: "club", header: "Club" },
      { key: "division", header: "League" },
      { key: "wage", header: "Wage", render: (v) => (v === null ? "" : formatWage(v as number)) },
      { key: "price", header: "Price", render: (v) => (v === null ? "" : formatWage(v as number)) },
      {
        key: "wageDemand",
        header: "Wage demand",
        render: (v) => (v === null ? "" : formatWage(v as number)),
      },
      {
        key: "contractExpires",
        header: "Contract",
        render: (v) => (v ? displayDate(v as Date) : "-"),
      },
      { key: "mins", header: "Mins" },
    ];

    for (const heat of keys.filter(isBriefStat)) {
      base.push(heatColumn(heat, thresholdText(columnFilters[heat.key]) ?? undefined));
    }
    for (const heat of keys.filter((k) => isGroup(k) && !isBriefStat(k))) {
      base.push(heatColumn(heat));
    }
    if (allStats) {
      for (const heat of keys.filter((k) => !isGroup(k) && !isBriefStat(k))) {
        base.push(heatColumn(heat));
      }
    }
    return base;
  }, [brief, list, allStats]);

  const sortColumn = availableColumns.find((c) => c.key === chosenSortKey);
  const sortKey = sortColumn ? chosenSortKey : "index";
  const sortDirection = sortColumn ? chosenDirection : "asc";
  const sortHeader = sortColumn?.header;
  const rankMode = sortKey === "index" && sortDirection === "asc";
  const columns = useMemo(
    () =>
      availableColumns.map((c) =>
        c.key === "index"
          ? {
              ...c,
              render: (v: unknown, row: BriefRow) => (
                <>
                  {rankMode && <DragGrip uid={row.uid} name={row.name} />}
                  {String(v)}
                </>
              ),
            }
          : c
      ),
    [availableColumns, rankMode]
  );
  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDirection), [rows, sortKey, sortDirection]);

  const endDrag = () => {
    setTimeout(() => {
      dragging.current = false;
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    endDrag();
    if (!over || over.id === active.id) return;
    const target = rows.find((r) => r.uid === over.id);
    if (!target) return;
    movePick(brief.id, list.uids, Number(active.id), target.index - 1);
  };

  return (
    <VStack gap={3} align="stretch">
      <HStack gap={4} flexWrap="wrap">
        <Checkbox.Root checked={allStats} onCheckedChange={(e) => setAllStats(e.checked === true)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>All stats</Checkbox.Label>
        </Checkbox.Root>
        <Tooltip content="This brief filters on no stats" disabled={canCompare}>
          <Checkbox.Root
            checked={compareMode && canCompare}
            disabled={!canCompare}
            onCheckedChange={(e) => {
              setCompareMode(e.checked === true);
              setPinnedUid(null);
              setHoveredUid(null);
            }}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>Who beats whom</Checkbox.Label>
          </Checkbox.Root>
        </Tooltip>
        <Text fontSize="sm" color="fg.muted">
          {rankMode ? (
            "Drag rows to reorder."
          ) : (
            <>
              {`Sorted by ${sortHeader} — `}
              <Button
                variant="plain"
                size="sm"
                p={0}
                h="auto"
                minW={0}
                color="glaucous.400"
                textDecoration="underline"
                verticalAlign="baseline"
                onClick={() => {
                  setSortKey("index");
                  setSortDirection("asc");
                }}
              >
                sort by rank
              </Button>
              {" to reorder"}
            </>
          )}
        </Text>
        {compareMode && canCompare && (
          <Text fontSize="sm" color="fg.muted">
            {!focusRow || !outcome
              ? "Hover a player to compare him on the brief's stats; click to pin."
              : !outcome.comparable
                ? `${focusRow.name} is missing brief stats, so he is not compared.`
                : `${focusRow.name} beats ${outcome.beats.size}, beaten by ${outcome.beatenBy.size}.`}
          </Text>
        )}
      </HStack>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragEnd={onDragEnd}
        onDragCancel={endDrag}
      >
        <Table<BriefRow>
          data={sortedRows}
          columns={columns}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(key, direction) => {
            setSortKey(key);
            setSortDirection(direction);
          }}
          getRowKey={(row) => row.uid}
          rowComponent={BriefDragRow}
          rowProps={(row) => ({
            className: "group",
            ...(row.absent ? { opacity: 0.6 } : {}),
            ...compareProps(row),
          })}
        />
      </DndContext>
    </VStack>
  );
}
