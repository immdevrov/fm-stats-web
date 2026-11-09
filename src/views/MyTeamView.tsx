import { Container, Heading, VStack, Box, Text, Spinner, HStack, Button, Tabs } from "@chakra-ui/react";
import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SearchableSelect } from "../components/SearchableSelect";
import { SquadTable } from "../components/SquadTable";
import { SquadPlanner } from "../components/planner/SquadPlanner";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useMyTeam } from "../contexts/MyTeamContext";
import { useRoster, useSnapshots } from "../contexts/SnapshotContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { markedSquad, type MarkedSquad } from "../utils/squad";
import { RosterErrorNotice } from "../components/RosterErrorNotice";
import { LoadErrorNotice } from "../components/LoadErrorNotice";

export function MyTeamView() {
  const { myClub, isLoaded, loadError, setMyClub, clearMyClub } = useMyTeam();
  const location = useLocation();
  const navigate = useNavigate();
  const isPlanner = location.pathname === "/my-team/planner";
  useDocumentTitle(myClub ? `My Team: ${myClub}` : "My Team");

  const [isPicking, setIsPicking] = useState(false);
  const { players: allPlayers, error: rosterError } = useRoster();

  const clubs = useMemo(
    () => (allPlayers ? [...new Set(allPlayers.map((p) => p.Club).filter(Boolean))].sort() : null),
    [allPlayers]
  );

  const { isNewest } = useSnapshots();
  const { annotations } = usePlayerNotes();
  const anyMarked = useMemo(
    () => [...annotations.values()].some((a) => a.transfer),
    [annotations]
  );

  const marked = useMemo((): MarkedSquad | null => {
    if (!allPlayers || !myClub) return null;
    if (isNewest) return markedSquad(allPlayers, myClub, annotations);
    const imported = allPlayers.filter((p) => p.Club === myClub);
    return { imported, incoming: [], outgoing: [], squad: imported };
  }, [allPlayers, myClub, isNewest, annotations]);

  const transfers = useMemo(
    () =>
      marked && {
        incoming: new Set(marked.incoming.map((p) => p.UID)),
        outgoing: new Set(marked.outgoing.map((p) => p.UID)),
      },
    [marked]
  );

  const handlePick = (club: string) => {
    if (club) setMyClub(club);
    else clearMyClub();
    setIsPicking(false);
  };

  if (rosterError) return <RosterErrorNotice error={rosterError} />;

  if (loadError) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="7xl">
          <LoadErrorNotice what="Your club" error={loadError} />
        </Container>
      </Box>
    );
  }

  if (!isLoaded) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="7xl">
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
        <Container maxW="7xl">
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

  return (
    <Box minH="100vh" p={8}>
      <Container maxW={isPlanner ? "full" : "7xl"}>
        <VStack gap={6} align="stretch">
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <HStack gap={3} align="baseline">
              <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
                {myClub}
              </Heading>
              {marked && (
                <Text fontSize="sm" color="fg.muted">
                  {marked.squad.length} players
                  {marked.incoming.length > 0 && ` · +${marked.incoming.length} in`}
                  {marked.outgoing.length > 0 && ` · −${marked.outgoing.length} out`}
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

          {!isNewest && anyMarked && (
            <Text fontSize="sm" color="fg.muted">
              Transfer marks apply to the newest snapshot only.
            </Text>
          )}

          {marked === null || transfers === null ? (
            <Spinner size="lg" colorPalette="glaucous" alignSelf="center" />
          ) : isPlanner ? (
            <SquadPlanner club={myClub} players={marked.squad} />
          ) : marked.imported.length === 0 ? (
            <Text color="fg.muted">{myClub} is not in the current data.</Text>
          ) : (
            <SquadTable players={[...marked.imported, ...marked.incoming]} transfers={transfers} />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
