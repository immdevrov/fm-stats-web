import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import { slotLabel } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { MAX_DEPTH } from "../../types/planner";

const EMPTY_LABEL = ["Nobody", "No cover", "Add"];

export function PlannerSlot({ slot }: { slot: FormationSlot }) {
  const { plan } = useSquadPlan();
  const placed = plan?.slots.find((s) => s.slotId === slot.id)?.players ?? [];

  return (
    <VStack flex="1 1 0" maxW="210px" align="stretch" gap="6px">
      <Text
        fontSize="9.5px"
        fontWeight="bold"
        letterSpacing="0.07em"
        color="softBlush.700"
        textTransform="uppercase"
      >
        {slotLabel(slot)}
      </Text>

      {placed.length < MAX_DEPTH && (
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
        >
          <Box aria-hidden>&#43;</Box>
          <Text>{EMPTY_LABEL[placed.length]}</Text>
        </HStack>
      )}
    </VStack>
  );
}
