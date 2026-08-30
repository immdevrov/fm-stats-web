import { HStack, VStack } from "@chakra-ui/react";
import type { Formation } from "../../formations";
import { PlannerSlot } from "./PlannerSlot";

export function PlannerBoard({ formation }: { formation: Formation }) {
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
              <PlannerSlot key={slot.id} slot={slot} />
            ))}
        </HStack>
      ))}
    </VStack>
  );
}
