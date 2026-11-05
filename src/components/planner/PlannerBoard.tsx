import { useMemo, useState } from "react";
import { Box, Grid } from "@chakra-ui/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { FormationSlot } from "../../formations";
import { GK_CELL, OUTFIELD_ROWS, cellKey } from "../../formations/grid";
import type { Player } from "../../types/types";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { byAgeDesc, slotLabel } from "../../utils/planner";
import { BoardCell } from "./BoardCell";
import { PlannerSlot } from "./PlannerSlot";

const COLUMNS = [0, 1, 2, 3, 4];
const ROWS_TOP_DOWN = [...OUTFIELD_ROWS].reverse();

export function PlannerBoard({
  slots,
  squad,
  listed,
  allPlayers,
  presentUids,
}: {
  slots: FormationSlot[];
  squad: Player[];
  listed: Player[];
  allPlayers: Player[];
  presentUids: Set<number>;
}) {
  const { moveMarker } = useSquadPlan();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current;
    if (data?.kind === "marker") setDraggedSlotId(data.slotId);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggedSlotId(null);
    const from = active.data.current;
    const to = over?.data.current;
    if (from?.kind === "marker" && to?.kind === "cell") moveMarker(from.slotId, to.cell);
  };

  const draggedSlot = slots.find((slot) => slot.id === draggedSlotId);

  const candidates = useMemo(() => {
    const byUid = new Map(listed.map((player) => [player.UID, player]));
    for (const player of squad) byUid.set(player.UID, player);
    return [...byUid.values()].sort(byAgeDesc);
  }, [squad, listed]);

  const byUid = useMemo(() => new Map(allPlayers.map((p) => [p.UID, p])), [allPlayers]);

  const slotAt = useMemo(() => new Map(slots.map((slot) => [cellKey(slot.cell), slot])), [slots]);

  const renderSlot = (slot: FormationSlot) => (
    <PlannerSlot
      key={slot.id}
      slot={slot}
      candidates={candidates}
      byUid={byUid}
      presentUids={presentUids}
    />
  );

  const gkSlot = slotAt.get(cellKey(GK_CELL));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggedSlotId(null)}
    >
      <Grid
        flexGrow={1}
        minW={0}
        gridTemplateColumns="repeat(5, minmax(0, 1fr))"
        columnGap="12px"
        rowGap="20px"
        alignItems="stretch"
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border.emphasized"
        borderRadius="md"
        p="18px 16px"
      >
        {ROWS_TOP_DOWN.flatMap((row) =>
          COLUMNS.map((col) => {
            const cell = { row, col };
            const slot = slotAt.get(cellKey(cell));
            return slot ? renderSlot(slot) : <BoardCell key={cellKey(cell)} cell={cell} />;
          })
        )}
        {gkSlot && (
          <Box display="grid" gridColumn={GK_CELL.col + 1}>
            {renderSlot(gkSlot)}
          </Box>
        )}
      </Grid>
      <DragOverlay>
        {draggedSlot && (
          <Box
            display="inline-block"
            px="8px"
            py="2px"
            borderRadius="md"
            bg="glaucous.500"
            color="white"
            fontSize="11px"
            fontWeight="bold"
          >
            {slotLabel(draggedSlot)}
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  );
}
