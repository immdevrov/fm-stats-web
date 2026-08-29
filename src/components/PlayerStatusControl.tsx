import { useState } from "react";
import { Box, Button, Checkbox, Input, Popover, Portal, VStack, Text } from "@chakra-ui/react";
import { PlayerStatusBadge } from "./PlayerStatusBadge";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";

export function PlayerStatusControl({
  uid,
  player,
}: {
  uid: number;
  player?: PlayerIdentity;
}) {
  const { lists, listsFor, addToList, removeFromList, createList, isUnwanted, toggleUnwanted } =
    usePlayerNotes();
  const [isOpen, setIsOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const unwanted = isUnwanted(uid);
  const memberIds = new Set(listsFor(uid).map((list) => list.id));

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
        <Box cursor="pointer" onClick={(e) => e.stopPropagation()}>
          <PlayerStatusBadge uid={uid} />
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="240px">
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
                      e.checked ? addToList(list.id, uid, player) : removeFromList(list.id, uid)
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
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
