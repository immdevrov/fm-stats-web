import { useMemo, useState } from "react";
import { Badge, Button, Checkbox, HStack, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { PlayerStatusControl } from "./PlayerStatusControl";
import { Table, type Column } from "./ui/table";
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
  return `color-mix(in oklab, var(--chakra-colors-${colour}-500) ${Math.round(Math.abs(d) * 75)}%, transparent)`;
}

function heatColumn(heat: HeatKey, subheader?: string): Column<BriefRow> {
  return {
    key: heat.key,
    header: heat.abbr,
    subheader,
    headerTooltip: heat.label,
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
  const { annotations, removeFromList } = usePlayerNotes();
  const [allStats, setAllStats] = useState(false);

  const rows = useMemo(
    () => buildBriefRows(brief, list, roster, rankings, annotations),
    [brief, list, roster, rankings, annotations]
  );

  const columns = useMemo(() => {
    const { columnFilters } = brief.filters;
    const keys = heatKeys(briefRoleConfig(brief));
    const isBriefStat = (heat: HeatKey) => thresholdText(columnFilters[heat.key]) !== null;
    const isGroup = (heat: HeatKey) => heat.key.startsWith("group_");

    const base: Column<BriefRow>[] = [
      { key: "index", header: "#", firstSortDirection: "asc" },
      {
        key: "name",
        header: "Player",
        render: (_v, row) => (
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
            {row.absent && (
              <Button size="2xs" variant="outline" onClick={() => removeFromList(list.id, row.uid)}>
                Remove
              </Button>
            )}
          </HStack>
        ),
      },
      { key: "age", header: "Age" },
      { key: "club", header: "Club" },
      { key: "division", header: "League" },
      { key: "wage", header: "Wage", render: (v) => (v === null ? "" : formatWage(v as number)) },
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
  }, [brief, list.id, allStats, removeFromList]);

  return (
    <VStack gap={3} align="stretch">
      <Checkbox.Root checked={allStats} onCheckedChange={(e) => setAllStats(e.checked === true)}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>All stats</Checkbox.Label>
      </Checkbox.Root>
      <Table<BriefRow>
        data={rows}
        columns={columns}
        defaultSortKey="index"
        defaultSortDirection="asc"
        rowProps={(row) => (row.absent ? { opacity: 0.6 } : {})}
      />
    </VStack>
  );
}
