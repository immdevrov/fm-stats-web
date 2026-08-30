import { useState } from "react";
import { HStack, Input, NativeSelect, Text } from "@chakra-ui/react";
import type { Formation } from "../../formations";
import { FORMATIONS } from "../../formations";
import { countSlotsWithoutCover } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { ConfirmDialog } from "../ui/confirm-dialog";

export function PlannerToolbar({ formation }: { formation: Formation }) {
  const { plan, setFormation, setHorizon } = useSquadPlan();
  const [pendingFormation, setPendingFormation] = useState<string | null>(null);

  const uncovered = countSlotsWithoutCover(plan, formation.slots.length);
  const hasPlacements = (plan?.slots ?? []).some((slot) => slot.players.length > 0);

  const handleSelect = (id: string) => {
    if (id === formation.id) return;
    if (hasPlacements) setPendingFormation(id);
    else setFormation(id);
  };

  return (
    <>
      <HStack gap={4} flexWrap="wrap" align="center">
        <NativeSelect.Root size="sm" width="140px">
          <NativeSelect.Field
            value={formation.id}
            onChange={(e) => handleSelect(e.currentTarget.value)}
          >
            {FORMATIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>

        <HStack gap={1}>
          <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
            Planning for:
          </Text>
          <Input
            type="text"
            placeholder="DD/MM/YYYY"
            value={plan?.horizon ?? ""}
            onChange={(e) => setHorizon(e.target.value || null)}
            maxW="130px"
            size="sm"
          />
        </HStack>

        <Text fontSize="sm" color="fg.muted">
          {uncovered === 0
            ? "Every slot has cover"
            : `${uncovered} ${uncovered === 1 ? "slot has" : "slots have"} no cover`}
        </Text>
      </HStack>

      <ConfirmDialog
        isOpen={pendingFormation !== null}
        onClose={() => setPendingFormation(null)}
        onConfirm={(value) => {
          setFormation(value);
          setPendingFormation(null);
        }}
        title="Change formation?"
        message="Every player on the board will be removed. There is only one board, so this cannot be undone."
        options={
          pendingFormation
            ? [{ label: `Switch to ${pendingFormation}`, value: pendingFormation }]
            : []
        }
      />
    </>
  );
}
