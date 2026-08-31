import { useMemo } from "react";
import { HStack, VStack } from "@chakra-ui/react";
import type { Formation } from "../../formations";
import type { Player } from "../../types/types";
import { PlannerSlot } from "./PlannerSlot";

export function PlannerBoard({
  formation,
  squad,
  listed,
}: {
  formation: Formation;
  squad: Player[];
  listed: Player[];
}) {
  const candidates = useMemo(() => {
    const byUid = new Map(listed.map((player) => [player.UID, player]));
    for (const player of squad) byUid.set(player.UID, player);
    return [...byUid.values()].sort((a, b) => a.Name.localeCompare(b.Name));
  }, [squad, listed]);

  const byUid = useMemo(() => new Map(candidates.map((p) => [p.UID, p])), [candidates]);

  const rows = [...new Set(formation.slots.map((slot) => slot.row))].sort((a, b) => b - a);

  return (
    <VStack
      flexGrow={1}
      minW={0}
      align="stretch"
      gap="20px"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p="18px 16px"
    >
      {rows.map((row) => (
        <HStack key={row} justify="center" gap="12px" align="stretch">
          {formation.slots
            .filter((slot) => slot.row === row)
            .map((slot) => (
              <PlannerSlot key={slot.id} slot={slot} candidates={candidates} byUid={byUid} />
            ))}
        </HStack>
      ))}
    </VStack>
  );
}
