import { Container, Heading, VStack, Box, Text, Spinner, HStack, Button, Tabs } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { db } from "../services/db";
import type { Player } from "../types/types";
import { SearchableSelect } from "../components/SearchableSelect";
import { SquadTable } from "../components/SquadTable";
import { SquadPlanner } from "../components/planner/SquadPlanner";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useMyTeam } from "../contexts/MyTeamContext";

export function MyTeamView() {
  const { myClub, isLoaded, setMyClub, clearMyClub } = useMyTeam();
  const location = useLocation();
  const navigate = useNavigate();
  const isPlanner = location.pathname === "/my-team/planner";
  useDocumentTitle(myClub ? `My Team: ${myClub}` : "My Team");

  const [clubs, setClubs] = useState<string[] | null>(null);
  const [squad, setSquad] = useState<{ club: string; players: Player[] } | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    db.getAllPlayers().then((all) => {
      setClubs([...new Set(all.map((p) => p.Club).filter(Boolean))].sort());
    });
  }, []);

  useEffect(() => {
    if (!myClub) return;
    let cancelled = false;
    db.getPlayersByClub(myClub).then((players) => {
      if (!cancelled) setSquad({ club: myClub, players });
    });
    return () => {
      cancelled = true;
    };
  }, [myClub]);

  const handlePick = (club: string) => {
    if (club) setMyClub(club);
    else clearMyClub();
    setIsPicking(false);
  };

  if (!isLoaded) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (!myClub || isPicking) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={6} align="stretch">
            <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
              {myClub ? "Change your club" : "Which club is yours?"}
            </Heading>

            {clubs === null ? (
              <Spinner size="md" colorPalette="glaucous" alignSelf="start" />
            ) : clubs.length === 0 ? (
              <VStack align="start" gap={4}>
                <Text color="fg.muted">No players imported yet.</Text>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/import">Go to Import</Link>
                </Button>
              </VStack>
            ) : (
              <SearchableSelect
                options={clubs}
                value={myClub ?? ""}
                onChange={handlePick}
                placeholder="Search clubs..."
                allLabel="No club selected"
                width="320px"
              />
            )}

            {isPicking && (
              <Button size="sm" variant="ghost" alignSelf="start" onClick={() => setIsPicking(false)}>
                Cancel
              </Button>
            )}
          </VStack>
        </Container>
      </Box>
    );
  }

  const players = squad?.club === myClub ? squad.players : null;

  return (
    <Box minH="100vh" p={8}>
      <Container maxW={isPlanner ? "container.2xl" : "container.lg"}>
        <VStack gap={6} align="stretch">
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <HStack gap={3} align="baseline">
              <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
                {myClub}
              </Heading>
              {players && (
                <Text fontSize="sm" color="fg.muted">
                  {players.length} players
                </Text>
              )}
            </HStack>
            <Button size="sm" variant="outline" onClick={() => setIsPicking(true)}>
              Change club
            </Button>
          </HStack>

          <Tabs.Root
            value={isPlanner ? "planner" : "squad"}
            onValueChange={(e) =>
              navigate(e.value === "planner" ? "/my-team/planner" : "/my-team")
            }
          >
            <Tabs.List>
              <Tabs.Trigger value="squad">Squad</Tabs.Trigger>
              <Tabs.Trigger value="planner">Planner</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          {players === null ? (
            <Spinner size="lg" colorPalette="glaucous" alignSelf="center" />
          ) : isPlanner ? (
            <SquadPlanner club={myClub} players={players} />
          ) : players.length === 0 ? (
            <Text color="fg.muted">{myClub} is not in the current data.</Text>
          ) : (
            <SquadTable players={players} />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
