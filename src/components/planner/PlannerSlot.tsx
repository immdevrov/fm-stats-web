import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { LuGripVertical } from "react-icons/lu";
import { cellKey } from "../../formations/grid";
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
  presentUids,
}: {
  slot: FormationSlot;
  candidates: Player[];
  byUid: Map<number, Player>;
  presentUids: Set<number>;
}) {
  const { plan } = useSquadPlan();
  const { active } = useDndContext();
  const markerDrag = active?.data.current?.kind === "marker";
  const isGk = slot.cell.row === "GK";
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `cell:${cellKey(slot.cell)}`,
    data: { kind: "cell", cell: slot.cell },
    disabled: !markerDrag,
  });
  const {
    attributes,
    listeners,
    setNodeRef: setGripRef,
  } = useDraggable({
    id: `marker:${slot.id}`,
    data: { kind: "marker", slotId: slot.id },
    disabled: isGk,
  });
  const placed = plan?.slots.find((s) => s.slotId === slot.id)?.players ?? [];

  return (
    <VStack
      ref={setDropRef}
      w="100%"
      maxW="210px"
      justifySelf="center"
      align="stretch"
      gap="6px"
      outline={markerDrag && !isGk ? "2px dashed" : undefined}
      outlineColor={isOver ? "glaucous.500" : "border.emphasized"}
      outlineOffset="2px"
      borderRadius="md"
    >
      <HStack gap="4px">
        {!isGk && (
          <Box
            as="button"
            ref={setGripRef}
            aria-label={`Move ${slotLabel(slot)} marker`}
            cursor="grab"
            touchAction="none"
            display="inline-flex"
            color="softBlush.700"
            {...attributes}
            {...listeners}
          >
            <LuGripVertical size={12} />
          </Box>
        )}
        <Text
          fontSize="9.5px"
          fontWeight="bold"
          letterSpacing="0.07em"
          color="softBlush.700"
          textTransform="uppercase"
        >
          {slotLabel(slot)}
        </Text>
      </HStack>

      {placed.map((planned, rank) => (
        <PlannerCard
          key={planned.uid}
          slot={slot}
          planned={planned}
          rank={rank}
          player={byUid.get(planned.uid)}
          present={presentUids.has(planned.uid)}
        />
      ))}

      {placed.length < MAX_DEPTH && (
        <CandidatePopover slot={slot} squad={candidates} label={EMPTY_LABEL[placed.length]} />
      )}
    </VStack>
  );
}
