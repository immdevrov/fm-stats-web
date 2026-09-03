import { useState } from "react";
import { Box, HStack, Popover, Portal, Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import { formatPositions, getEffectivePosition } from "../../utils/utils";
import { matchesSlot } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";

export function CandidatePopover({
  slot,
  squad,
  label,
}: {
  slot: FormationSlot;
  squad: Player[];
  label: string;
}) {
  const { plan, place } = useSquadPlan();
  const { lists } = usePlayerNotes();
  const [isOpen, setIsOpen] = useState(false);

  const inThisSlot = new Set(
    (plan?.slots.find((s) => s.slotId === slot.id)?.players ?? []).map((p) => p.uid)
  );
  const listedUids = new Set(lists.flatMap((list) => list.uids));

  const candidates = squad.filter((player) => !inThisSlot.has(player.UID));
  const matching = candidates.filter((player) => matchesSlot(player, slot));
  const rest = candidates.filter((player) => !matchesSlot(player, slot));

  const row = (player: Player) => (
    <HStack
      key={player.UID}
      px={2}
      py="6px"
      gap={2}
      borderRadius="md"
      cursor="pointer"
      _hover={{ bg: "bg.muted" }}
      onClick={() => {
        place(slot.id, { uid: player.UID, name: player.Name, club: player.Club });
        setIsOpen(false);
      }}
    >
      {listedUids.has(player.UID) && (
        <Text as="span" color="glaucous.500" lineHeight="1" aria-label="On a list">
          &#9733;
        </Text>
      )}
      <VStack align="start" gap={0} flexGrow={1} minW={0}>
        <HStack gap="5px" align="baseline" minW={0} maxW="100%">
          <Text fontSize="xs" fontWeight="semibold" truncate>
            {player.Name}
          </Text>
          <Text fontSize="10.5px" color="softBlush.800" flexShrink={0}>
            {player.Age}
          </Text>
        </HStack>
        <Text fontSize="10.5px" color="softBlush.800">
          {formatPositions(getEffectivePosition(player))} &middot; {player.Club}
        </Text>
      </VStack>
    </HStack>
  );

  return (
    <Popover.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Popover.Trigger asChild>
        <HStack
          justify="center"
          gap="6px"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.emphasized"
          borderRadius="md"
          p="10px"
          color="softBlush.700"
          fontSize="xs"
          cursor="pointer"
          _hover={{ bg: "bg.muted" }}
        >
          <Box aria-hidden>&#43;</Box>
          <Text>{label}</Text>
        </HStack>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="280px">
            <Popover.Body maxH="420px" overflowY="auto" p={2}>
              <VStack align="stretch" gap={0}>
                {matching.map(row)}
                {rest.length > 0 && (
                  <>
                    <Text
                      fontSize="10px"
                      fontWeight="bold"
                      color="softBlush.700"
                      textTransform="uppercase"
                      letterSpacing="0.07em"
                      px={2}
                      pt={3}
                      pb={1}
                      borderTopWidth={matching.length > 0 ? "1px" : undefined}
                      borderColor="border.emphasized"
                    >
                      Out of position
                    </Text>
                    {rest.map(row)}
                  </>
                )}
                {candidates.length === 0 && (
                  <Text fontSize="xs" color="fg.muted" p={2}>
                    Nobody left to add.
                  </Text>
                )}
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
