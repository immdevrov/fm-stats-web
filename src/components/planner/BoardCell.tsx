import { Box } from "@chakra-ui/react";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { cellKey, cellPosition, isPlayableCell, type Cell } from "../../formations/grid";
import { formatPositions } from "../../utils/utils";

export function BoardCell({ cell }: { cell: Cell }) {
  const playable = isPlayableCell(cell);
  const { active } = useDndContext();
  const markerDrag = active?.data.current?.kind === "marker";
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${cellKey(cell)}`,
    data: { kind: "cell", cell },
    disabled: !playable || !markerDrag,
  });

  if (!playable) return <Box aria-hidden h="100%" minH="36px" />;

  return (
    <Box
      ref={setNodeRef}
      role="group"
      aria-label={`Empty ${formatPositions([cellPosition(cell)])}`}
      h="100%"
      minH="36px"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={isOver ? "glaucous.500" : markerDrag ? "border.emphasized" : "border.muted"}
      outline={isOver ? "2px solid" : undefined}
      outlineColor="glaucous.500"
      borderRadius="md"
    />
  );
}
