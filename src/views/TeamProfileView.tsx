import {
  Container,
  Heading,
  VStack,
  Box,
  Text,
  Spinner,
  HStack,
  Button,
  Badge,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SquadTable } from "../components/SquadTable";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useMyTeam } from "../contexts/MyTeamContext";
import { useRoster } from "../contexts/SnapshotContext";
import { toaster } from "../components/ui/toaster";

export function TeamProfileView() {
  const { teamName } = useParams<{ teamName: string }>();
  const navigate = useNavigate();
  const { myClub, isLoaded: isMyTeamLoaded, setMyClub } = useMyTeam();
  const { players: allPlayers } = useRoster();

  const decodedTeamName = teamName ? decodeURIComponent(teamName) : "";
  useDocumentTitle(decodedTeamName ? `Team: ${decodedTeamName}` : "Teams");

  const players = useMemo(
    () => (allPlayers ? allPlayers.filter((p) => p.Club === decodedTeamName) : null),
    [allPlayers, decodedTeamName]
  );

  if (!decodedTeamName) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={4}>
            <Box p={4} borderRadius="md" bg="red.500" color="white">
              <Text fontWeight="medium">No team specified</Text>
            </Box>
            <Button variant="outline" onClick={() => navigate("/teams")}>
              Back to Teams
            </Button>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (players === null) {
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
            {isMyTeamLoaded &&
              (myClub === decodedTeamName ? (
                <Badge colorPalette="glaucous" size="lg">
                  My Team
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMyClub(decodedTeamName);
                    toaster.create({
                      title: "My Team Set",
                      description: `${decodedTeamName} is now your team.`,
                      type: "success",
                      duration: 3000,
                    });
                  }}
                >
                  Set as My Team
                </Button>
              ))}
          </HStack>

          {players.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No players found for this team.
            </Text>
          ) : (
            <SquadTable players={players} />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
