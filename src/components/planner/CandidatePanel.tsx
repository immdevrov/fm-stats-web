import { useState } from "react";
import { Box, HStack, Tabs, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { Player } from "../../types/types";
import { displayDate, formatPositions, getEffectivePosition } from "../../utils/utils";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { useMyTeam } from "../../contexts/MyTeamContext";

function CandidateRow({ player }: { player: Player }) {
  const { annotations } = usePlayerNotes();
  const { myClub } = useMyTeam();
  const unwanted = annotations.get(player.UID)?.unwanted === true;

  return (
    <HStack
      px={2}
      py="6px"
      gap={2}
      borderRadius="md"
      bg={unwanted ? "bg.subtle" : undefined}
      _hover={{ bg: "bg.muted" }}
    >
      <VStack align="stretch" gap={0} flexGrow={1} minW={0} opacity={unwanted ? 0.5 : 1}>
        <HStack gap="5px" align="baseline">
          <Link to={`/players/${player.UID}`}>
            <Text
              fontSize="12.5px"
              fontWeight="semibold"
              textDecoration={unwanted ? "line-through" : undefined}
              _hover={{ textDecoration: "underline" }}
            >
              {player.Name}
            </Text>
          </Link>
          <Text fontSize="10.5px" color="softBlush.800">
            {player.Age}
          </Text>
        </HStack>
        <Text fontSize="10.5px" color="softBlush.800" truncate>
          {formatPositions(getEffectivePosition(player))} &middot;{" "}
          {player.Club !== myClub
            ? player.Club
            : player.Expires
              ? displayDate(player.Expires)
              : player.Club}
        </Text>
      </VStack>
      {unwanted && (
        <Text as="span" color="spicyPaprika.500" fontSize="sm" lineHeight="1" flexShrink={0}>
          &#8856;
        </Text>
      )}
    </HStack>
  );
}

export function CandidatePanel({ squad, listed }: { squad: Player[]; listed: Player[] }) {
  const { placements } = useSquadPlan();
  const [tab, setTab] = useState("squad");

  const unplaced = squad.filter((player) => !placements.has(player.UID));
  const rows = tab === "squad" ? unplaced : listed;

  return (
    <VStack
      w="300px"
      flexShrink={0}
      align="stretch"
      gap={0}
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      maxH="calc(100vh - 260px)"
    >
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)}>
        <Tabs.List>
          <Tabs.Trigger value="squad">Squad &middot; {unplaced.length} unplaced</Tabs.Trigger>
          <Tabs.Trigger value="lists">Lists &middot; {listed.length}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <Box overflowY="auto" p={2}>
        {rows.length === 0 ? (
          <Text fontSize="xs" color="fg.muted" p={2}>
            {tab === "squad" ? "Everyone is on the board." : "No players on any list yet."}
          </Text>
        ) : (
          <VStack align="stretch" gap="2px">
            {rows.map((player) => (
              <CandidateRow key={player.UID} player={player} />
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
