import { Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import { slotLabel } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { MAX_DEPTH } from "../../types/planner";
import { PlannerCard } from "./PlannerCard";
import { CandidatePopover } from "./CandidatePopover";

const EMPTY_LABEL = ["Nobody", "No cover", "Add"];

export function PlannerSlot({
  slot,
  candidates,
  byUid,
}: {
  slot: FormationSlot;
  candidates: Player[];
  byUid: Map<number, Player>;
}) {
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

      {placed.map((planned, rank) => (
        <PlannerCard
          key={planned.uid}
          slot={slot}
          planned={planned}
          rank={rank}
          player={byUid.get(planned.uid)}
        />
      ))}

      {placed.length < MAX_DEPTH && (
        <CandidatePopover slot={slot} squad={candidates} label={EMPTY_LABEL[placed.length]} />
      )}
    </VStack>
  );
}
