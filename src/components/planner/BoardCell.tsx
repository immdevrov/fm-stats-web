import { Box } from "@chakra-ui/react";
import { cellPosition, isPlayableCell, type Cell } from "../../formations/grid";
import { formatPositions } from "../../utils/utils";

export function BoardCell({ cell }: { cell: Cell }) {
  if (!isPlayableCell(cell)) return <Box aria-hidden h="100%" minH="36px" />;

  return (
    <Box
      role="group"
      aria-label={`Empty ${formatPositions([cellPosition(cell)])}`}
      h="100%"
      minH="36px"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.muted"
      borderRadius="md"
    />
  );
}
