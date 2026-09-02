import { Badge, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { useSnapshots } from "../contexts/SnapshotContext";
import { isoToDisplay } from "../utils/import-date";
import type { Snapshot } from "../types/snapshot";

function snapshotLabel(snapshot: Snapshot): string {
  const date = snapshot.date ? isoToDisplay(snapshot.date) : "Undated";
  return snapshot.label ? `${date} — ${snapshot.label}` : date;
}

export function SnapshotSwitcher() {
  const { snapshots, activeId, active, isNewest, isLoaded, setActive } = useSnapshots();

  if (!isLoaded || snapshots.length === 0) return null;

  return (
    <VStack align="stretch" gap={1}>
      {snapshots.length === 1 ? (
        <Text fontSize="sm" color="fg.muted">
          {active ? snapshotLabel(active) : ""}
        </Text>
      ) : (
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            value={activeId ?? ""}
            onChange={(e) => setActive(e.currentTarget.value)}
            aria-label="Data date"
          >
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshotLabel(snapshot)}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      )}

      {!isNewest && (
        <Badge colorPalette="spicyPaprika" alignSelf="flex-start">
          Historic
        </Badge>
      )}
    </VStack>
  );
}
