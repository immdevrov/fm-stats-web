import { useState } from "react";
import { Button, HStack, NativeSelect, Text } from "@chakra-ui/react";
import { PRESETS, getPreset, shapeName, type FormationSlot } from "../../formations";
import { countSlotsWithoutCover } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { useSnapshots } from "../../contexts/SnapshotContext";
import type { HorizonPreset } from "../../types/planner";
import { ConfirmDialog } from "../ui/confirm-dialog";

const HORIZON_OPTIONS: Array<{ value: HorizonPreset; label: string }> = [
  { value: "now", label: "Now" },
  { value: "season", label: "End of season" },
  { value: "1y", label: "In one year" },
  { value: "2y", label: "In two years" },
];

export function PlannerToolbar({
  slots,
  presentUids,
}: {
  slots: FormationSlot[];
  presentUids: Set<number>;
}) {
  const { plan, applyPreset, setHorizon, removeMissing } = useSquadPlan();
  const { active, isNewest } = useSnapshots();
  const [pendingFormation, setPendingFormation] = useState<string | null>(null);

  const uncovered = countSlotsWithoutCover(plan, slots.length);
  const hasPlacements = (plan?.slots ?? []).some((slot) => slot.players.length > 0);
  const missing = (plan?.slots ?? [])
    .flatMap((slot) => slot.players)
    .filter((player) => !presentUids.has(player.uid)).length;

  const handleSelect = (id: string) => {
    if (hasPlacements) setPendingFormation(id);
    else applyPreset(id);
  };

  return (
    <>
      <HStack gap={4} flexWrap="wrap" align="center">
        <Text fontSize="sm" fontWeight="semibold" whiteSpace="nowrap">
          Shape: {shapeName(slots.map((slot) => slot.cell))}
        </Text>
        <NativeSelect.Root size="sm" width="160px">
          <NativeSelect.Field
            value=""
            onChange={(e) => handleSelect(e.currentTarget.value)}
          >
            <option value="">Apply preset…</option>
            {PRESETS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>

        <HStack gap={1}>
          <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
            Contracts as of:
          </Text>
          <NativeSelect.Root size="sm" width="160px" disabled={!active?.date}>
            <NativeSelect.Field
              value={plan?.horizon ?? ""}
              onChange={(e) => setHorizon((e.currentTarget.value || null) as HorizonPreset | null)}
            >
              <option value="">No tint</option>
              {HORIZON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </HStack>

        <Text fontSize="sm" color="fg.muted">
          {uncovered === 0
            ? "Every slot has cover"
            : `${uncovered} ${uncovered === 1 ? "slot has" : "slots have"} no cover`}
        </Text>

        {missing > 0 && (
          <HStack gap={2}>
            <Text fontSize="sm" color="spicyPaprika.500">
              {missing} no longer in the squad
            </Text>
            <Button size="xs" variant="outline" disabled={!isNewest} onClick={() => removeMissing(presentUids)}>
              Remove missing
            </Button>
            {!isNewest && (
              <Text fontSize="sm" color="fg.muted">
                Only available on the newest data.
              </Text>
            )}
          </HStack>
        )}
      </HStack>

      <ConfirmDialog
        isOpen={pendingFormation !== null}
        onClose={() => setPendingFormation(null)}
        onConfirm={(value) => {
          applyPreset(value);
          setPendingFormation(null);
        }}
        title="Apply preset?"
        message="Every player on the board will be removed. There is only one board, so this cannot be undone."
        options={
          pendingFormation
            ? [{ label: `Apply ${getPreset(pendingFormation)?.name ?? pendingFormation}`, value: pendingFormation }]
            : []
        }
      />
    </>
  );
}
