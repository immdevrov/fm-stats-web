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
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../services/db";
import type { Player } from "../types/types";
import { SquadTable } from "../components/SquadTable";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useMyTeam } from "../contexts/MyTeamContext";
import { toaster } from "../components/ui/toaster";

export function TeamProfileView() {
  const { teamName } = useParams<{ teamName: string }>();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { myClub, isLoaded: isMyTeamLoaded, setMyClub } = useMyTeam();

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
