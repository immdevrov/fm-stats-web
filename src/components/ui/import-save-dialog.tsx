import { useEffect, useState } from "react";
import { Button, Dialog, Input, Portal, RadioGroup, Text, VStack } from "@chakra-ui/react";
import { deriveDateFromFilename, displayToIso, isoToDisplay } from "../../utils/import-date";
import type { Snapshot } from "../../types/snapshot";

export function ImportSaveDialog({
  isOpen,
  filename,
  snapshots,
  snapshotsLoaded,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  filename: string;
  snapshots: Snapshot[];
  snapshotsLoaded: boolean;
  onClose: () => void;
  onConfirm: (choice: { mode: "same" | "new"; date: string; replacesId: string | null }) => void;
}) {
  const [mode, setMode] = useState<"same" | "new" | null>(null);
  const [dateText, setDateText] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setMode(null); // eslint-disable-line react-hooks/set-state-in-effect
    setDateText(isoToDisplay(deriveDateFromFilename(filename)));
  }, [isOpen, filename]);

  const iso = displayToIso(dateText);
  const clash = iso ? snapshots.find((s) => s.date === iso) : undefined;
  const canImport = mode !== null && iso !== null && snapshotsLoaded;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Import {filename}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <RadioGroup.Root
                  value={mode ?? ""}
                  onValueChange={(e) => setMode(e.value as "same" | "new")}
                >
                  <RadioGroup.Label>Which save is this?</RadioGroup.Label>
                  <VStack align="stretch" gap={2}>
                    <RadioGroup.Item value="same">
                      <RadioGroup.ItemHiddenInput />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>
                        Same save — add this as another date point
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="new">
                      <RadioGroup.ItemHiddenInput />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>
                        New save — erase everything first
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                  </VStack>
                </RadioGroup.Root>

                {mode === "new" && (
                  <Text fontSize="sm" color="spicyPaprika.500">
                    Every snapshot, custom position, list, price, note, league ranking, your
                    club and your squad plan will be deleted. This cannot be undone.
                  </Text>
                )}

                <VStack align="stretch" gap={1}>
                  <Text fontSize="sm" color="fg.muted">
                    What in-game date is this data?
                  </Text>
                  <Input
                    placeholder="DD/MM/YYYY"
                    value={dateText}
                    onChange={(e) => setDateText(e.target.value)}
                    maxW="160px"
                  />
                  {dateText !== "" && iso === null && (
                    <Text fontSize="sm" color="spicyPaprika.500">
                      Not a date. Use DD/MM/YYYY.
                    </Text>
                  )}
                  {mode === "same" && clash && (
                    <Text fontSize="sm" color="fg.muted">
                      A snapshot already exists for this date. Importing replaces it.
                    </Text>
                  )}
                </VStack>

                {!snapshotsLoaded && (
                  <Text fontSize="sm" color="fg.muted">
                    Loading existing snapshots…
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorPalette={mode === "new" ? "spicyPaprika" : "glaucous"}
                disabled={!canImport}
                onClick={() =>
                  onConfirm({
                    mode: mode!,
                    date: iso!,
                    replacesId: mode === "same" ? (clash?.id ?? null) : null,
                  })
                }
              >
                {mode === "new" ? "Erase and import" : "Import"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
