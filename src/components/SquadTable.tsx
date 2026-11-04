import { Badge, HStack, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { Player } from "../types/types";
import { Table, type Column } from "./ui/table";
import { formatWage, displayDate, formatPositions, getEffectivePosition } from "../utils/utils";
import { PlayerStatusControl } from "./PlayerStatusControl";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";

interface SquadRow extends Record<string, unknown> {
  name: string;
  age: number;
  position: string;
  starts: number;
  minutes: number;
  nat: string;
  wage: number;
  injuries: boolean;
  contractExpires: Date | null;
  uid: number;
  club: string;
}

export function SquadTable({
  players,
  transfers,
}: {
  players: Player[];
  transfers?: { incoming: Set<number>; outgoing: Set<number> };
}) {
  const { isUnwanted } = usePlayerNotes();
  const isIncoming = (uid: number) => transfers?.incoming.has(uid) === true;
  const isOutgoing = (uid: number) => transfers?.outgoing.has(uid) === true;

  const data: SquadRow[] = players.map((p) => ({
    name: p.Name,
    age: p.Age,
    position: formatPositions(getEffectivePosition(p)),
    starts: p.Starts,
    minutes: p.Mins,
    nat: p.Nat,
    wage: p.Wage,
    injuries: p.RcInjury,
    contractExpires: p.Expires,
    uid: p.UID,
    club: p.Club,
  }));

  const columns: Column<SquadRow>[] = [
    {
      key: "uid",
      id: "status",
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
      render: (value, row) => (
        <HStack gap={2}>
          <Link to={`/players/${row.uid}`}>
            <Text color="glaucous.400" _hover={{ textDecoration: "underline" }}>
              {value as string}
            </Text>
          </Link>
          {isIncoming(row.uid) && (
            <Badge colorPalette="glaucous" variant="subtle" size="sm">
              IN · from {row.club}
            </Badge>
          )}
          {isOutgoing(row.uid) && (
            <Badge colorPalette="spicyPaprika" variant="subtle" size="sm">
              OUT
            </Badge>
          )}
        </HStack>
      ),
    },
    { key: "age", header: "Age" },
    { key: "position", header: "Position" },
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
    { key: "uid", header: "UID", sortable: false },
  ];

  return (
    <Table<SquadRow>
      data={data}
      columns={columns}
      defaultSortKey="starts"
      defaultSortDirection="desc"
      rowProps={(row) =>
        isUnwanted(row.uid) || isOutgoing(row.uid) ? { color: "fg.muted", bg: "bg.subtle" } : {}
      }
    />
  );
}
