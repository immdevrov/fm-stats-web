import { useMemo } from "react";
import { Box, Grid } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import { GK_CELL, OUTFIELD_ROWS, cellKey } from "../../formations/grid";
import type { Player } from "../../types/types";
import { byAgeDesc } from "../../utils/planner";
import { BoardCell } from "./BoardCell";
import { PlannerSlot } from "./PlannerSlot";

const COLUMNS = [0, 1, 2, 3, 4];
const ROWS_TOP_DOWN = [...OUTFIELD_ROWS].reverse();

export function PlannerBoard({
  slots,
  squad,
  listed,
  byUid,
  presentUids,
}: {
  slots: FormationSlot[];
  squad: Player[];
  listed: Player[];
  byUid: Map<number, Player>;
  presentUids: Set<number>;
}) {
  const candidates = useMemo(() => {
    const byCandidateUid = new Map(listed.map((player) => [player.UID, player]));
    for (const player of squad) byCandidateUid.set(player.UID, player);
    return [...byCandidateUid.values()].sort(byAgeDesc);
  }, [squad, listed]);

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
    <Grid
      flexGrow={1}
      minW={0}
      gridTemplateColumns="repeat(5, minmax(0, 1fr))"
      columnGap="12px"
      rowGap="10px"
      alignItems="stretch"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p="10px 12px"
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
  );
}
