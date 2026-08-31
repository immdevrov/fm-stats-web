import { Button, Dialog, HStack, Portal, Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import { getFormation } from "../../formations";
import type { Player } from "../../types/types";
import type { PlannedPlayer } from "../../types/planner";
import { formatPositions, getEffectivePosition } from "../../utils/utils";
import { matchesSlot, slotLabel } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { db } from "../../services/db";
import { toaster } from "../ui/toaster";

export function MismatchDialog({
  slot,
  player,
  planned,
  isOpen,
  onClose,
}: {
  slot: FormationSlot;
  player: Player;
  planned: PlannedPlayer;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { plan, place, remove } = useSquadPlan();
  const { refresh } = usePlayerNotes();

  const formation = plan ? getFormation(plan.formationId) : undefined;
  const openMatching = (formation?.slots ?? []).filter(
    (candidate) =>
      candidate.id !== slot.id &&
      matchesSlot(player, candidate) &&
      !(plan?.slots.find((s) => s.slotId === candidate.id)?.players ?? []).some(
        (p) => p.uid === planned.uid
      )
  );

  const addPosition = async () => {
    try {
      await db.updatePlayerPosition(planned.uid, [
        ...getEffectivePosition(player),
        slot.position,
      ]);
      await refresh();
      onClose();
    } catch {
      toaster.create({
        title: "Position Not Saved",
        description: "His positions could not be updated.",
        type: "error",
        duration: 3000,
      });
    }
  };

  const moveTo = (target: FormationSlot) => {
    remove(slot.id, planned.uid);
    place(target.id, planned);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Out of position</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Text fontSize="sm">
                  {player.Name} plays{" "}
                  <Text as="span" fontWeight="semibold">
                    {formatPositions(getEffectivePosition(player))}
                  </Text>
                  . This slot is{" "}
                  <Text as="span" fontWeight="semibold">
                    {slotLabel(slot)}
                  </Text>
                  .
                </Text>

                <VStack align="stretch" gap={2}>
                  <Button variant="outline" justifyContent="flex-start" onClick={addPosition}>
                    Add {slotLabel(slot)} to his positions
                  </Button>
                  <Text fontSize="xs" color="fg.muted">
                    A custom position also moves him between Scouting cohorts — every role check
                    reads the same effective position.
                  </Text>

                  {openMatching.length > 0 && (
                    <>
                      <Text fontSize="xs" fontWeight="bold" color="fg.muted" pt={2}>
                        MOVE HIM TO
                      </Text>
                      <HStack gap={2} flexWrap="wrap">
                        {openMatching.map((target) => (
                          <Button
                            key={target.id}
                            size="sm"
                            variant="outline"
                            onClick={() => moveTo(target)}
                          >
                            {slotLabel(target)}
                          </Button>
                        ))}
                      </HStack>
                    </>
                  )}
                </VStack>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose}>
                Leave it — he plays out of position
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
