import { useMemo, useState, type ReactNode } from "react";
import { Box } from "@chakra-ui/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { slotLabel } from "../../utils/planner";
import { DragStateContext, type DragKind, type DragState } from "./dragKind";

interface Dragged {
  kind: DragKind;
  slotId: string | null;
  uid: number | null;
  name: string | null;
}

const IDLE: Dragged = { kind: null, slotId: null, uid: null, name: null };

// dnd-kit scrolls an ancestor by the pointer's height alone, so the panel would scroll while dragging over the board.
const AUTO_SCROLL = { canScroll: (element: Element) => !element.hasAttribute("data-no-autoscroll") };

export function PlannerDnd({
  slots,
  byUid,
  children,
}: {
  slots: FormationSlot[];
  byUid: Map<number, Player>;
  children: ReactNode;
}) {
  const { moveMarker, moveCard, placeCandidate } = useSquadPlan();
  const { annotations } = usePlayerNotes();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dragged, setDragged] = useState<Dragged>(IDLE);

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current;
    setDragged({
      kind: data?.kind ?? null,
      slotId: data?.kind === "marker" ? data.slotId : null,
      uid: data?.kind === "card" || data?.kind === "candidate" ? data.uid : null,
      name: data?.kind === "card" || data?.kind === "candidate" ? data.name : null,
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(IDLE);
    const from = active.data.current;
    const to = over?.data.current;
    if (from?.kind === "marker" && to?.kind === "cell") moveMarker(from.slotId, to.cell);
    const target =
      to?.kind === "card"
        ? { slotId: to.slotId as string, index: to.index as number }
        : to?.kind === "add"
          ? { slotId: to.slotId as string, index: null }
          : null;
    if (!target) return;
    if (from?.kind === "card") moveCard({ slotId: from.slotId, uid: from.uid }, target);
    if (from?.kind === "candidate") {
      placeCandidate({ uid: from.uid, name: from.name, club: from.club }, target);
    }
  };

  const labelOf = (data: Record<string, unknown> | undefined) =>
    data?.kind === "card" || data?.kind === "candidate"
      ? String(data.name)
      : `${slotLabel(slots.find((slot) => slot.id === data?.slotId) ?? slots[0])} marker`;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(active.data.current)}`,
    onDragOver: () => undefined,
    onDragEnd: ({ active }) => `Dropped ${labelOf(active.data.current)}`,
    onDragCancel: ({ active }) => `Cancelled moving ${labelOf(active.data.current)}`,
  };

  const draggedPlayer = dragged.uid === null ? undefined : byUid.get(dragged.uid);
  const customPosition =
    dragged.uid === null ? undefined : annotations.get(dragged.uid)?.customPosition;

  const state = useMemo<DragState>(
    () => ({
      kind: dragged.kind,
      player: draggedPlayer
        ? {
            Position: draggedPlayer.Position,
            CustomPosition: customPosition ?? draggedPlayer.CustomPosition,
          }
        : null,
    }),
    [dragged.kind, draggedPlayer, customPosition]
  );

  const draggedSlot = slots.find((slot) => slot.id === dragged.slotId);
  const chip = dragged.name ?? (draggedSlot ? slotLabel(draggedSlot) : null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={AUTO_SCROLL}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "" } }}
      onDragCancel={() => setDragged(IDLE)}
    >
      <DragStateContext.Provider value={state}>{children}</DragStateContext.Provider>
      <DragOverlay>
        {chip && (
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
            {chip}
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  );
}
