import { useEffect, useMemo, useState } from "react";
import { Box, Button, Container, HStack, Heading, Spinner, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { db } from "../services/db";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { Table, type Column } from "../components/ui/table";
import { formatWage, displayDate, formatPositions, getEffectivePosition } from "../utils/utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Player } from "../types/types";

const UNWANTED_TAB = "__unwanted__";

interface ListRow extends Record<string, unknown> {
  uid: number;
  name: string;
  missing: boolean;
  age: number | null;
  position: string;
  club: string;
  division: string;
  wage: number | null;
  price: number | null;
  wageDemand: number | null;
  expires: Date | null;
  note: string;
}

export function ListsView() {
  useDocumentTitle("Lists");
  const { lists, annotations, isLoaded, createList, renameList, deleteList, removeFromList } =
    usePlayerNotes();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    db.getAllPlayers().then((loaded) => {
      setPlayers(loaded);
      setPlayersLoaded(true);
    });
  }, []);

  const playersByUid = useMemo(
    () => new Map(players.map((player) => [player.UID, player])),
    [players]
  );

  const currentTab = activeTab ?? lists[0]?.id ?? UNWANTED_TAB;
  const isUnwantedTab = currentTab === UNWANTED_TAB;
  const activeList = lists.find((list) => list.id === currentTab);

  const uids = useMemo(() => {
    if (isUnwantedTab) {
      return [...annotations.values()].filter((a) => a.unwanted).map((a) => a.uid);
    }
    return activeList?.uids ?? [];
  }, [isUnwantedTab, annotations, activeList]);

  const rows: ListRow[] = useMemo(
    () =>
      uids.map((uid) => {
        const player = playersByUid.get(uid);
        const annotation = annotations.get(uid);
        return {
          uid,
          name: player?.Name ?? annotation?.lastKnownName ?? `UID ${uid}`,
          missing: !player,
          age: player?.Age ?? null,
          position: player ? formatPositions(getEffectivePosition(player)) : "",
          club: player?.Club ?? annotation?.lastKnownClub ?? "",
          division: player?.Division ?? "",
          wage: player?.Wage ?? null,
          price: annotation?.price ?? null,
          wageDemand: annotation?.wageDemand ?? null,
          expires: player?.Expires ?? null,
          note: annotation?.note ?? "",
        };
      }),
    [uids, playersByUid, annotations]
  );

  if (!isLoaded || !playersLoaded) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.xl">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading lists...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  const missingCount = rows.filter((row) => row.missing).length;

  const columns: Column<ListRow>[] = [
    {
      key: "uid",
      header: "",
      sortable: false,
      width: "56px",
      render: (_value, row) => (
        <PlayerStatusControl
          uid={row.uid}
          player={{ Name: row.name, Club: row.club }}
        />
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (value, row) =>
        row.missing ? (
          <HStack gap={2}>
            <Text>{value as string}</Text>
            <Text fontSize="2xs" color="fg.muted" borderWidth="1px" borderStyle="dashed" px={1}>
              NOT IN DATA
            </Text>
          </HStack>
        ) : (
          <Link to={`/players/${row.uid}`}>
            <Text color="glaucous.400" _hover={{ textDecoration: "underline" }}>
              {value as string}
            </Text>
          </Link>
        ),
    },
    { key: "age", header: "Age", render: (v) => (v === null ? "–" : String(v)) },
    { key: "position", header: "Position" },
    { key: "club", header: "Club" },
    { key: "division", header: "Division" },
    { key: "wage", header: "Wage", render: (v) => (v === null ? "–" : formatWage(v as number)) },
    { key: "price", header: "Price", render: (v) => (v === null ? "–" : formatWage(v as number)) },
    {
      key: "wageDemand",
      header: "Wage Demand",
      render: (v) => (v === null ? "–" : formatWage(v as number)),
    },
    { key: "expires", header: "Expires", render: (v) => (v ? displayDate(v as Date) : "–") },
    { key: "note", header: "Note", render: (v) => (v as string) || "" },
  ];

  if (!isUnwantedTab && activeList) {
    columns.push({
      key: "missing",
      header: "",
      sortable: false,
      width: "40px",
      render: (_value, row) => (
        <Text
          cursor="pointer"
          color="fg.muted"
          onClick={() => removeFromList(activeList.id, row.uid)}
        >
          &#215;
        </Text>
      ),
    });
  }

  const handleCreate = async () => {
    const name = window.prompt("List name");
    if (name?.trim()) {
      const list = await createList(name.trim());
      setActiveTab(list.id);
    }
  };

  const handleRename = async () => {
    if (!activeList) return;
    const name = window.prompt("Rename list", activeList.name);
    if (name?.trim()) await renameList(activeList.id, name.trim());
  };

  const handleDelete = async () => {
    if (!activeList) return;
    if (window.confirm(`Delete "${activeList.name}"? Players are not affected.`)) {
      await deleteList(activeList.id);
      setActiveTab(null);
    }
  };

  const handleRemoveMissing = async () => {
    if (!activeList) return;
    for (const row of rows.filter((r) => r.missing)) {
      await removeFromList(activeList.id, row.uid);
    }
  };

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.xl">
        <VStack gap={6} align="stretch">
          <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
            Lists
          </Heading>

          <HStack gap={2} flexWrap="wrap">
            {lists.map((list) => (
              <Button
                key={list.id}
                size="sm"
                variant={currentTab === list.id ? "solid" : "outline"}
                colorPalette="glaucous"
                onClick={() => setActiveTab(list.id)}
              >
                {list.name} ({list.uids.length})
              </Button>
            ))}
            <Button
              size="sm"
              variant={isUnwantedTab ? "solid" : "outline"}
              colorPalette="spicyPaprika"
              onClick={() => setActiveTab(UNWANTED_TAB)}
            >
              Unwanted ({[...annotations.values()].filter((a) => a.unwanted).length})
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCreate}>
              + New list
            </Button>
          </HStack>

          {!isUnwantedTab && activeList && (
            <HStack gap={2} flexWrap="wrap">
              <Button size="xs" variant="ghost" onClick={handleRename}>
                Rename
              </Button>
              <Button size="xs" variant="ghost" onClick={handleDelete}>
                Delete list
              </Button>
              {missingCount > 0 && (
                <HStack gap={2}>
                  <Text fontSize="sm" color="spicyPaprika.500">
                    {missingCount} not in current data
                  </Text>
                  <Button size="xs" variant="outline" onClick={handleRemoveMissing}>
                    Remove missing
                  </Button>
                </HStack>
              )}
            </HStack>
          )}

          {isUnwantedTab && (
            <Text fontSize="sm" color="fg.muted">
              Ruled out, or a deal that proved impossible. They still count in every percentile
              cohort — nothing here is removed from the database.
            </Text>
          )}

          {rows.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              Nothing here yet.
            </Text>
          ) : (
            <Table<ListRow>
              data={rows}
              columns={columns}
              defaultSortKey="name"
              defaultSortDirection="asc"
              rowProps={(row) => (row.missing ? { opacity: 0.5 } : {})}
            />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
