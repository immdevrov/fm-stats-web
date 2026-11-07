import { Box, Text } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import { cellKey, cellPosition, isPlayableCell, type Cell } from "../../formations/grid";
import { formatPositions } from "../../utils/utils";
import { matchesSlot } from "../../utils/planner";
import { useDragKind, useDraggedPlayer, usePlayerDrag } from "./dragKind";

export function BoardCell({ cell }: { cell: Cell }) {
  const playable = isPlayableCell(cell);
  const markerDrag = useDragKind() === "marker";
  const playerDrag = usePlayerDrag();
  const dragged = useDraggedPlayer();
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${cellKey(cell)}`,
    data: { kind: "cell", cell },
    disabled: !playable || !markerDrag,
  });

  if (!playable) return <Box aria-hidden h="100%" minH="24px" />;

  const position = cellPosition(cell);
  const label = formatPositions([position]);
  const canPlay = playerDrag && dragged !== null && matchesSlot(dragged, { position });

  return (
    <Box
      ref={setNodeRef}
      role="group"
      aria-label={`Empty ${label}`}
      data-hint={canPlay ? "match" : undefined}
      display="flex"
      alignItems="center"
      justifyContent="center"
      h="100%"
      minH="24px"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={
        isOver
          ? "glaucous.500"
          : markerDrag
            ? "border.emphasized"
            : canPlay
              ? "glaucous.300"
              : "transparent"
      }
      outline={isOver ? "2px solid" : undefined}
      outlineColor="glaucous.500"
      borderRadius="md"
    >
      {canPlay && (
        <Text aria-hidden fontSize="9.5px" fontWeight="bold" color="glaucous.400">
          {label}
        </Text>
      )}
    </Box>
  );
}
