import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, Portal, Text, VStack } from "@chakra-ui/react";

export type PreserveCategory = "rankings" | "positions" | "lists";

const LABELS: Record<PreserveCategory, string> = {
  rankings: "League rankings",
  positions: "Custom positions",
  lists: "Lists, prices and unwanted flags",
};

export function ImportPreserveDialog({
  isOpen,
  available,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  available: PreserveCategory[];
  onClose: () => void;
  onConfirm: (clear: PreserveCategory[]) => void;
}) {
  const [kept, setKept] = useState<Set<PreserveCategory>>(new Set(available));

  useEffect(() => {
    if (isOpen) setKept(new Set(available)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [isOpen, available]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Preserve your data?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={3}>
                <Text>Anything left checked survives this import.</Text>
                {available.map((category) => (
                  <Checkbox.Root
                    key={category}
                    checked={kept.has(category)}
                    onCheckedChange={(e) =>
                      setKept((prev) => {
                        const next = new Set(prev);
                        if (e.checked) next.add(category);
                        else next.delete(category);
                        return next;
                      })
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>{LABELS[category]}</Checkbox.Label>
                  </Checkbox.Root>
                ))}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorPalette="glaucous"
                onClick={() => onConfirm(available.filter((c) => !kept.has(c)))}
              >
                Import
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
