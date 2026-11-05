import { Box } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import { cellKey, cellPosition, isPlayableCell, type Cell } from "../../formations/grid";
import { formatPositions } from "../../utils/utils";
import { useDragKind } from "./dragKind";

export function BoardCell({ cell }: { cell: Cell }) {
  const playable = isPlayableCell(cell);
  const markerDrag = useDragKind() === "marker";
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${cellKey(cell)}`,
    data: { kind: "cell", cell },
    disabled: !playable || !markerDrag,
  });

  if (!playable) return <Box aria-hidden h="100%" minH="24px" />;

  return (
    <Box
      ref={setNodeRef}
      role="group"
      aria-label={`Empty ${formatPositions([cellPosition(cell)])}`}
      h="100%"
      minH="24px"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={isOver ? "glaucous.500" : markerDrag ? "border.emphasized" : "transparent"}
      outline={isOver ? "2px solid" : undefined}
      outlineColor="glaucous.500"
      borderRadius="md"
    />
  );
}
