import {
  Container,
  Heading,
  VStack,
  Box,
  Text,
  Spinner,
  HStack,
  Button,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../services/db";
import type { Player } from "../types/types";
import { Table, type Column } from "../components/ui/table";
import { formatWage, displayDate, formatPositions, getEffectivePosition } from "../utils/utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";

interface TeamProfileRow extends Record<string, unknown> {
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
}

export function TeamProfileView() {
  const { teamName } = useParams<{ teamName: string }>();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const decodedTeamName = teamName ? decodeURIComponent(teamName) : "";
  useDocumentTitle(decodedTeamName ? `Team: ${decodedTeamName}` : "Teams");

  useEffect(() => {
    async function loadData() {
      if (!decodedTeamName) {
        setError("No team specified");
        setIsLoading(false);
        return;
      }

      try {
        const teamPlayers = await db.getPlayersByClub(decodedTeamName);
        setPlayers(teamPlayers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load team");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [decodedTeamName]);

  if (isLoading) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading team...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={4}>
            <Box p={4} borderRadius="md" bg="red.500" color="white">
              <Text fontWeight="medium">{error}</Text>
            </Box>
            <Button variant="outline" onClick={() => navigate("/teams")}>
              Back to Teams
            </Button>
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
            <VStack align="start" gap={1}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate("/teams")}
              >
                &larr; Back to Teams
              </Button>
              <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
                {decodedTeamName}
              </Heading>
            </VStack>
          </HStack>

          {players.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No players found for this team.
            </Text>
          ) : (
            <TeamProfileTable players={players} teamName={decodedTeamName} />
          )}
        </VStack>
      </Container>
    </Box>
  );
}

function TeamProfileTable({ players, teamName }: { players: Player[]; teamName: string }) {
  const { isUnwanted } = usePlayerNotes();

  const data: TeamProfileRow[] = players.map((p) => ({
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
  }));

  const columns: Column<TeamProfileRow>[] = [
    {
      key: "uid",
      id: "status",
      header: "",
      sortable: false,
      width: "56px",
      render: (_value, row) => (
        <PlayerStatusControl uid={row.uid} player={{ Name: row.name, Club: teamName }} />
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (value, row) => (
        <Link to={`/players/${row.uid}`}>
          <Text color="glaucous.400" _hover={{ textDecoration: "underline" }}>
            {value as string}
          </Text>
        </Link>
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
    <Table<TeamProfileRow>
      data={data}
      columns={columns}
      defaultSortKey="starts"
      defaultSortDirection="desc"
      rowProps={(row) => (isUnwanted(row.uid) ? { color: "fg.muted", bg: "bg.subtle" } : {})}
    />
  );
}
