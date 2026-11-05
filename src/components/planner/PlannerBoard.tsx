import { useMemo } from "react";
import { HStack, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import { OUTFIELD_ROWS, type GridRow } from "../../formations/grid";
import type { Player } from "../../types/types";
import { byAgeDesc } from "../../utils/planner";
import { PlannerSlot } from "./PlannerSlot";

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
  const candidates = useMemo(() => {
    const byUid = new Map(listed.map((player) => [player.UID, player]));
    for (const player of squad) byUid.set(player.UID, player);
    return [...byUid.values()].sort(byAgeDesc);
  }, [squad, listed]);

  const byUid = useMemo(() => new Map(allPlayers.map((p) => [p.UID, p])), [allPlayers]);

  const rows = ([...OUTFIELD_ROWS].reverse() as GridRow[])
    .concat("GK")
    .filter((row) => slots.some((slot) => slot.cell.row === row));

  return (
    <VStack
      flexGrow={1}
      minW={0}
      align="stretch"
      gap="20px"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p="18px 16px"
    >
      {rows.map((row) => (
        <HStack key={row} justify="center" gap="12px" align="stretch">
          {slots
            .filter((slot) => slot.cell.row === row)
            .sort((a, b) => a.cell.col - b.cell.col)
            .map((slot) => (
              <PlannerSlot
                key={slot.id}
                slot={slot}
                candidates={candidates}
                byUid={byUid}
                presentUids={presentUids}
              />
            ))}
        </HStack>
      ))}
    </VStack>
  );
}
