import { useState } from "react";
import { Button, Dialog, HStack, Input, NativeSelect, Portal, Text, VStack } from "@chakra-ui/react";
import type { PlayerList } from "../types/annotations";

export type LinkListChoice = { listId: string } | { newName: string };

interface LinkListDialogProps {
  isOpen: boolean;
  title: string;
  lists: PlayerList[];
  initialListId: string | null;
  defaultNewName: string;
  onSubmit: (choice: LinkListChoice) => void;
  onClose: () => void;
}

export function LinkListDialog({ isOpen, ...rest }: LinkListDialogProps) {
  if (!isOpen) return null;
  return <OpenLinkListDialog {...rest} />;
}

function OpenLinkListDialog({
  title,
  lists,
  initialListId,
  defaultNewName,
  onSubmit,
  onClose,
}: Omit<LinkListDialogProps, "isOpen">) {
  const [listId, setListId] = useState(
    initialListId && lists.some((list) => list.id === initialListId) ? initialListId : ""
  );
  const [name, setName] = useState(defaultNewName);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (listId) {
      onSubmit({ listId });
      onClose();
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (lists.some((list) => list.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("A list with that name exists — pick it above.");
      return;
    }
    onSubmit({ newName: trimmed });
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={2} align="stretch">
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field
                    aria-label="List"
                    value={listId}
                    onChange={(e) => {
                      setListId(e.currentTarget.value);
                      setError(null);
                    }}
                  >
                    <option value="">New list</option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                {!listId && (
                  <Input
                    aria-label="Name"
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                )}
                {error && (
                  <Text fontSize="sm" color="fg.error">
                    {error}
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button colorPalette="glaucous" onClick={submit}>
                  Link
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
