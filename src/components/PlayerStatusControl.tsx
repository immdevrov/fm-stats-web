import { useState } from "react";
import { Box, Button, Checkbox, Input, Popover, Portal, VStack, Text } from "@chakra-ui/react";
import { PlayerStatusBadge } from "./PlayerStatusBadge";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";
import { useMyTeam } from "../contexts/MyTeamContext";
import { useBriefs } from "../contexts/BriefContext";
import { useRoster } from "../contexts/SnapshotContext";
import { db } from "../services/db";
import { toaster } from "./ui/toaster";
import { briefCohortWarning } from "../utils/brief-cohort-warning";
import type { PlayerList, TransferMark } from "../types/annotations";

export function PlayerStatusControl({
  uid,
  player,
}: {
  uid: number;
  player?: PlayerIdentity;
}) {
  const {
    lists,
    listsFor,
    addToList,
    removeFromList,
    createList,
    isUnwanted,
    toggleUnwanted,
    transferOf,
    setTransfer,
  } = usePlayerNotes();
  const { myClub } = useMyTeam();
  const { briefs } = useBriefs();
  const { players: roster } = useRoster();
  const [isOpen, setIsOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const unwanted = isUnwanted(uid);
  const transfer = transferOf(uid);
  const transferAction: { label: string; value: TransferMark | null } | null =
    transfer === "in"
      ? { label: "Clear arriving", value: null }
      : transfer === "out"
        ? { label: "Clear leaving", value: null }
        : myClub
          ? player?.Club === myClub
            ? { label: "Mark as leaving", value: "out" }
            : { label: "Mark as arriving", value: "in" }
          : null;
  const memberIds = new Set(listsFor(uid).map((list) => list.id));

  const warnIfOutsideBriefs = async (list: PlayerList) => {
    try {
      if (!briefs.some((brief) => brief.listId === list.id)) return;
      const rosterPlayer = roster?.find((p) => p.UID === uid);
      if (!rosterPlayer) return;
      const warning = briefCohortWarning(rosterPlayer, list, briefs, await db.getLeagueRankings());
      if (warning) toaster.create({ ...warning, type: "warning", duration: 6000 });
    } catch {
      /* the check is advisory */
    }
  };

  const handleAdd = (list: PlayerList) => {
    void addToList(list.id, uid, player).then(() => warnIfOutsideBriefs(list));
  };

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    const list = await createList(name);
    await addToList(list.id, uid, player);
    setNewListName("");
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Popover.Trigger asChild>
        <Box role="button" aria-label="Player status" cursor="pointer" onClick={(e) => e.stopPropagation()}>
          <PlayerStatusBadge uid={uid} />
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="240px" onClick={(e) => e.stopPropagation()}>
            <Popover.Body>
              <VStack align="stretch" gap={2}>
                <Text fontSize="xs" fontWeight="bold" color="fg.muted">
                  ADD TO LIST
                </Text>
                {lists.map((list) => (
                  <Checkbox.Root
                    key={list.id}
                    checked={memberIds.has(list.id)}
                    disabled={unwanted}
                    onCheckedChange={(e) =>
                      e.checked ? handleAdd(list) : removeFromList(list.id, uid)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>{list.name}</Checkbox.Label>
                  </Checkbox.Root>
                ))}
                <Input
                  size="sm"
                  placeholder="New list…"
                  value={newListName}
                  disabled={unwanted}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="spicyPaprika"
                  onClick={() => toggleUnwanted(uid, player)}
                >
                  {unwanted ? "Clear unwanted" : "Mark as unwanted"}
                </Button>
                {transferAction && (
                  <Button
                    size="sm"
                    variant="ghost"
                    colorPalette="glaucous"
                    onClick={() => setTransfer(uid, transferAction.value, player)}
                  >
                    {transferAction.label}
                  </Button>
                )}
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
