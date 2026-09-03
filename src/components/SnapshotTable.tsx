import { useEffect, useState } from "react";
import { Badge, Box, Button, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useSnapshots } from "../contexts/SnapshotContext";
import { displayToIso, isoToDisplay } from "../utils/import-date";
import { db } from "../services/db";
import { toaster } from "./ui/toaster";
import { ConfirmDialog } from "./ui/confirm-dialog";

function reportFailure(title: string, error: unknown) {
  toaster.create({
    title,
    description: error instanceof Error ? error.message : "An unknown error occurred.",
    type: "error",
    duration: 7000,
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function SnapshotTable() {
  const { snapshots, activeId, isLoaded, loadError, setActive, removeSnapshot, editSnapshot } =
    useSnapshots();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [dateText, setDateText] = useState("");
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((estimate) => {
        if (estimate.usage !== undefined && estimate.quota !== undefined) {
          setUsage({ used: estimate.usage, quota: estimate.quota });
        }
      })
      .catch(() => setUsage(null));
  }, [snapshots]);

  if (!isLoaded) return null;

  if (loadError) {
    return (
      <Box p={4} borderRadius="md" bg="red.500" color="white">
        <Text fontWeight="medium">
          Your imported data could not be read ({loadError}). Importing a file below is the way
          back — it leaves your lists, notes, prices and squad plan alone.
        </Text>
      </Box>
    );
  }

  if (snapshots.length === 0) return null;

  return (
    <VStack align="stretch" gap={2}>
      <Text fontWeight="medium" color="fg.emphasized">
        Imported data
      </Text>

      {snapshots.map((snapshot) => (
        <HStack
          key={snapshot.id}
          justify="space-between"
          borderWidth="1px"
          borderRadius="md"
          p={2}
          gap={3}
        >
          <HStack gap={2} flex={1} minW={0}>
            {editing === snapshot.id ? (
              <>
                <Input
                  size="sm"
                  maxW="130px"
                  placeholder="DD/MM/YYYY"
                  value={dateText}
                  onChange={(e) => setDateText(e.target.value)}
                />
                <Button
                  size="xs"
                  colorPalette="glaucous"
                  disabled={displayToIso(dateText) === null}
                  onClick={async () => {
                    try {
                      await editSnapshot(snapshot.id, { date: displayToIso(dateText) });
                      setEditing(null);
                    } catch (error) {
                      reportFailure("Date not saved", error);
                    }
                  }}
                >
                  Save
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Text>{snapshot.date ? isoToDisplay(snapshot.date) : "Undated"}</Text>
                {snapshot.label && (
                  <Text color="fg.muted" truncate>
                    {snapshot.label}
                  </Text>
                )}
                {snapshot.id === activeId && <Badge colorPalette="glaucous">Showing</Badge>}
              </>
            )}
          </HStack>

          <HStack gap={2}>
            <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
              {snapshot.playerCount.toLocaleString()} players
            </Text>
            {snapshot.id !== activeId && (
              <Button size="xs" variant="outline" onClick={() => setActive(snapshot.id)}>
                Show
              </Button>
            )}
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing(snapshot.id);
                setDateText(isoToDisplay(snapshot.date));
              }}
            >
              Set date
            </Button>
            <Button
              size="xs"
              variant="outline"
              colorPalette="spicyPaprika"
              disabled={snapshots.length === 1}
              onClick={() => setPendingDelete(snapshot.id)}
            >
              Delete
            </Button>
          </HStack>
        </HStack>
      ))}

      <HStack gap={3}>
        {usage && (
          <Text fontSize="sm" color="fg.muted">
            Using {formatBytes(usage.used)} of {formatBytes(usage.quota)} available.
          </Text>
        )}
        <Button
          size="xs"
          variant="ghost"
          loading={purging}
          onClick={async () => {
            setPurging(true);
            try {
              const removed = await db.purgeOrphanedRows();
              toaster.create({
                title: removed > 0 ? "Leftover rows removed" : "Nothing to clean up",
                description:
                  removed > 0
                    ? `${removed.toLocaleString()} rows from an interrupted import were deleted.`
                    : "No rows without a snapshot were found.",
                type: "success",
                duration: 5000,
              });
            } catch (error) {
              reportFailure("Clean-up failed", error);
            } finally {
              setPurging(false);
            }
          }}
        >
          Clean up leftover rows
        </Button>
      </HStack>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async (value: string) => {
          try {
            await removeSnapshot(value);
          } catch (error) {
            reportFailure("Snapshot not deleted", error);
          }
          setPendingDelete(null);
        }}
        title="Delete this snapshot?"
        message="Its players are removed permanently. Annotations, lists and your plan are not touched."
        options={pendingDelete ? [{ label: "Delete", value: pendingDelete }] : []}
      />
    </VStack>
  );
}
