import { useEffect, useState } from "react";
import { Button, Dialog, Input, Portal, RadioGroup, Text, VStack } from "@chakra-ui/react";
import { deriveDateFromFilename, displayToIso, isoToDisplay } from "../../utils/import-date";
import type { Snapshot } from "../../types/snapshot";

export function ImportSaveDialog({
  isOpen,
  filename,
  snapshots,
  snapshotsLoaded,
  snapshotsError,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  filename: string;
  snapshots: Snapshot[];
  snapshotsLoaded: boolean;
  snapshotsError: string | null;
  onClose: () => void;
  onConfirm: (choice: { mode: "same" | "new"; date: string; replaces: string[] }) => void;
}) {
  const [mode, setMode] = useState<"same" | "new" | null>(null);
  const [dateText, setDateText] = useState("");
  const [onClash, setOnClash] = useState<"replace" | "add" | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(null); // eslint-disable-line react-hooks/set-state-in-effect
    setDateText(isoToDisplay(deriveDateFromFilename(filename)));
    setOnClash(null);
  }, [isOpen, filename]);

  const iso = displayToIso(dateText);
  const clashes = iso ? snapshots.filter((s) => s.date === iso) : [];
  const asksAboutClash = mode === "same" && clashes.length > 0;
  const canImport =
    mode !== null && iso !== null && snapshotsLoaded && (!asksAboutClash || onClash !== null);

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
                    onChange={(e) => {
                      setDateText(e.target.value);
                      setOnClash(null);
                    }}
                    maxW="160px"
                  />
                  {dateText !== "" && iso === null && (
                    <Text fontSize="sm" color="spicyPaprika.500">
                      Not a date. Use DD/MM/YYYY.
                    </Text>
                  )}
                </VStack>

                {asksAboutClash && (
                  <RadioGroup.Root
                    value={onClash ?? ""}
                    onValueChange={(e) => setOnClash(e.value as "replace" | "add")}
                  >
                    <RadioGroup.Label>
                      A snapshot already exists for this date. What should this import do?
                    </RadioGroup.Label>
                    <VStack align="stretch" gap={2}>
                      <RadioGroup.Item value="replace">
                        <RadioGroup.ItemHiddenInput />
                        <RadioGroup.ItemIndicator />
                        <RadioGroup.ItemText>
                          Replace — every snapshot already on this date is deleted
                        </RadioGroup.ItemText>
                      </RadioGroup.Item>
                      <RadioGroup.Item value="add">
                        <RadioGroup.ItemHiddenInput />
                        <RadioGroup.ItemIndicator />
                        <RadioGroup.ItemText>
                          Add a second snapshot for this date — keep both
                        </RadioGroup.ItemText>
                      </RadioGroup.Item>
                    </VStack>
                  </RadioGroup.Root>
                )}

                {!snapshotsLoaded && (
                  <Text fontSize="sm" color="fg.muted">
                    Loading existing snapshots…
                  </Text>
                )}

                {snapshotsLoaded && snapshotsError && (
                  <Text fontSize="sm" color="spicyPaprika.500">
                    Existing snapshots could not be read ({snapshotsError}), so this import cannot
                    tell whether one already exists for that date. Importing still works.
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
                    replaces:
                      asksAboutClash && onClash === "replace" ? clashes.map((s) => s.id) : [],
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
