import { HStack, Menu, Portal, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import type { PlannedPlayer } from "../../types/planner";
import { displayDate, formatPositions, getEffectivePosition } from "../../utils/utils";
import { useSquadPlan } from "../../contexts/SquadPlanContext";

export function PlannerCard({
  slot,
  planned,
  rank,
  player,
}: {
  slot: FormationSlot;
  planned: PlannedPlayer;
  rank: number;
  player: Player | undefined;
}) {
  const { remove, makeFirstChoice } = useSquadPlan();

  const positions = player ? formatPositions(getEffectivePosition(player)) : "";
  const trailing = player
    ? player.Expires
      ? displayDate(player.Expires)
      : planned.club
    : "not in current data";

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <HStack
          align="center"
          gap={2}
          borderWidth="1px"
          borderColor="border.emphasized"
          borderRadius="md"
          bg="bg.canvas"
          p="7px 8px"
          cursor="pointer"
          opacity={player ? 1 : 0.5}
        >
          <Text
            flexShrink={0}
            w="17px"
            h="17px"
            borderRadius="full"
            bg="bg.muted"
            color="fg.muted"
            fontSize="10px"
            fontWeight="semibold"
            textAlign="center"
            lineHeight="17px"
          >
            {rank + 1}
          </Text>
          <VStack align="stretch" gap="2px" flexGrow={1} minW={0}>
            <HStack gap="5px" align="baseline">
              <Text fontSize="12.5px" fontWeight="semibold" truncate>
                {player?.Name ?? planned.name}
              </Text>
              {player && (
                <Text fontSize="10.5px" color="softBlush.800">
                  {player.Age}
                </Text>
              )}
            </HStack>
            <Text fontSize="10.5px" color="softBlush.800" truncate>
              {positions ? `${positions} · ${trailing}` : trailing}
            </Text>
          </VStack>
        </HStack>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {rank > 0 && (
              <Menu.Item value="first" onSelect={() => makeFirstChoice(slot.id, planned.uid)}>
                Make first choice
              </Menu.Item>
            )}
            {player && (
              <Menu.Item value="profile" asChild>
                <Link to={`/players/${planned.uid}`}>Open profile</Link>
              </Menu.Item>
            )}
            <Menu.Item value="remove" onSelect={() => remove(slot.id, planned.uid)}>
              Remove
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
