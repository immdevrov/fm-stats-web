import { useState } from "react";
import { Badge, chakra, HStack, Menu, Portal, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useDragKind } from "./dragKind";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { LuGripVertical } from "react-icons/lu";
import { boardSlots, type FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import type { PlannedPlayer } from "../../types/planner";
import { displayDate, formatPositions, getEffectivePosition } from "../../utils/utils";
import { describeMismatch, resolveHorizon, placementFacts, slotLabel } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { useSnapshots } from "../../contexts/SnapshotContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { useMyTeam } from "../../contexts/MyTeamContext";
import { Tooltip } from "../ui/tooltip";
import { MismatchDialog } from "./MismatchDialog";

export function PlannerCard({
  slot,
  planned,
  rank,
  player,
  present,
}: {
  slot: FormationSlot;
  planned: PlannedPlayer;
  rank: number;
  player: Player | undefined;
  present: boolean;
}) {
  const { plan, placements, remove, makeFirstChoice } = useSquadPlan();
  const { active: activeSnapshot } = useSnapshots();
  const { annotations, listsFor } = usePlayerNotes();
  const { myClub } = useMyTeam();
  const [showMismatch, setShowMismatch] = useState(false);

  const cardDrag = useDragKind() === "card";
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `card:${slot.id}:${planned.uid}`,
    data: { kind: "card", slotId: slot.id, index: rank },
    disabled: !cardDrag,
  });
  const {
    attributes,
    listeners,
    setNodeRef: setGripRef,
    isDragging,
  } = useDraggable({
    id: `grip:${slot.id}:${planned.uid}`,
    data: { kind: "card", slotId: slot.id, uid: planned.uid, name: player?.Name ?? planned.name },
  });

  const customPosition = player ? annotations.get(planned.uid)?.customPosition : undefined;
  const effectivePlayer: Player | undefined =
    player && customPosition ? { ...player, CustomPosition: customPosition } : player;

  const mismatch = effectivePlayer ? describeMismatch(effectivePlayer, slot) : null;
  const elsewhereLabel = (slotId: string) => {
    const other = plan ? boardSlots(plan).find((s) => s.id === slotId) : undefined;
    return other ? slotLabel(other) : slotId;
  };
  const memberships = listsFor(planned.uid);
  const unwanted = annotations.get(planned.uid)?.unwanted === true;

  const horizon = resolveHorizon(activeSnapshot?.date ?? null, plan?.horizon ?? null);
  const expiring = Boolean(horizon && player?.Expires && player.Expires <= horizon);

  const { elsewhere, firstChoiceCount } = placementFacts(placements, planned.uid, slot.id);
  const departed = Boolean(player) && !present;
  const arriving =
    annotations.get(planned.uid)?.transfer === "in" && Boolean(player) && player!.Club !== myClub;

  const positions = effectivePlayer ? formatPositions(getEffectivePosition(effectivePlayer)) : "";
  const trailing = player
    ? player.Club && player.Club !== myClub
      ? player.Club
      : player.Expires
        ? displayDate(player.Expires)
        : player.Club
    : "not in current data";

  return (
    <>
      <HStack
        ref={setDropRef}
        gap="2px"
        align="stretch"
        borderRadius="md"
        outline={isOver ? "2px solid" : undefined}
        outlineColor="glaucous.500"
        opacity={isDragging ? 0.4 : 1}
      >
        <chakra.button
          type="button"
          ref={setGripRef}
          aria-label={`Drag ${player?.Name ?? planned.name}`}
          cursor="grab"
          touchAction="none"
          display="inline-flex"
          alignItems="center"
          color="softBlush.700"
          {...attributes}
          tabIndex={-1}
          {...listeners}
        >
          <LuGripVertical size={12} />
        </chakra.button>
        <Menu.Root>
          <Menu.Trigger asChild>
            <HStack
              flexGrow={1}
              minW={0}
              align="center"
              gap={2}
              borderWidth="1px"
              borderColor={mismatch ? "spicyPaprika.200" : "border.emphasized"}
              borderLeftWidth={memberships.length > 0 ? "3px" : "1px"}
              borderLeftColor={memberships.length > 0 ? "glaucous.500" : undefined}
              borderRadius="md"
              bg={mismatch ? "spicyPaprika.50" : "bg.canvas"}
              p="4px 8px"
              pl={memberships.length > 0 ? "6px" : "8px"}
              cursor="pointer"
              opacity={player && !departed ? 1 : 0.5}
            >
              <Text
                flexShrink={0}
                w="17px"
                h="17px"
                borderRadius="full"
                bg={mismatch ? "spicyPaprika.100" : "bg.muted"}
                color={mismatch ? "spicyPaprika.700" : "fg.muted"}
                fontSize="10px"
                fontWeight="semibold"
                textAlign="center"
                lineHeight="17px"
                opacity={unwanted ? 0.5 : 1}
              >
                {rank + 1}
              </Text>

              <VStack
                align="stretch"
                gap="1px"
                lineHeight="1.3"
                flexGrow={1}
                minW={0}
                opacity={unwanted ? 0.5 : 1}
              >
                <HStack gap="5px" align="baseline">
                  <Text
                    fontSize="12.5px"
                    fontWeight="semibold"
                    truncate
                    textDecoration={unwanted ? "line-through" : undefined}
                  >
                    {player?.Name ?? planned.name}
                  </Text>
                  {player && (
                    <Text fontSize="10.5px" color="softBlush.800">
                      {player.Age}
                    </Text>
                  )}
                </HStack>
                <Text
                  fontSize="10.5px"
                  color={mismatch ? "spicyPaprika.700" : "softBlush.800"}
                  truncate
                >
                  {positions ? `${positions} · ` : ""}
                  {mismatch ? (
                    mismatch
                  ) : expiring ? (
                    <Text as="span" color="spicyPaprika.500" fontWeight="semibold">
                      {trailing}
                    </Text>
                  ) : (
                    trailing
                  )}
                </Text>
              </VStack>

              <HStack gap="5px" flexShrink={0}>
                {memberships.length > 0 && (
                  <Tooltip content={memberships.map((list) => list.name).join(", ")}>
                    <Text as="span" color="glaucous.500" fontSize="sm" lineHeight="1">
                      &#9733;
                    </Text>
                  </Tooltip>
                )}
                {unwanted && (
                  <Tooltip content="Unwanted">
                    <Text as="span" color="spicyPaprika.500" fontSize="sm" lineHeight="1">
                      &#8856;
                    </Text>
                  </Tooltip>
                )}
                {arriving && (
                  <Tooltip content="Arriving">
                    <Text as="span" color="glaucous.500" fontSize="sm" lineHeight="1">
                      &#8600;
                    </Text>
                  </Tooltip>
                )}
                {departed && (
                  <Tooltip
                    content={
                      player!.Club === myClub
                        ? "Marked as leaving"
                        : `No longer at ${myClub} — now at ${player!.Club}`
                    }
                  >
                    <Text
                      as="span"
                      color="spicyPaprika.500"
                      fontSize="sm"
                      lineHeight="1"
                      aria-label="No longer in the squad"
                    >
                      &#8594;
                    </Text>
                  </Tooltip>
                )}
                {player?.RcInjury && (
                  <Tooltip content="Injury-prone">
                    <Text as="span" color="softBlush.800" fontSize="sm" lineHeight="1">
                      &#10010;
                    </Text>
                  </Tooltip>
                )}
                {mismatch && (
                  <Tooltip content={`Out of position — this slot is ${slotLabel(slot)}`}>
                    <Text as="span" color="spicyPaprika.500" fontSize="sm" lineHeight="1">
                      &#9888;
                    </Text>
                  </Tooltip>
                )}
                {elsewhere.length > 0 && (
                  <Tooltip
                    content={
                      firstChoiceCount > 1
                        ? `First choice in ${firstChoiceCount} slots — he cannot start in both`
                        : `Also in ${elsewhere.map((p) => elsewhereLabel(p.slotId)).join(", ")}`
                    }
                  >
                    <Badge
                      size="sm"
                      variant={firstChoiceCount > 1 ? "solid" : "outline"}
                      colorPalette={firstChoiceCount > 1 ? "spicyPaprika" : "gray"}
                    >
                      {firstChoiceCount > 1 ? `1st ×${firstChoiceCount}` : "⇄"}
                    </Badge>
                  </Tooltip>
                )}
              </HStack>
            </HStack>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {rank > 0 && (
                  <Menu.Item value="first" onSelect={() => makeFirstChoice(slot.id, planned.uid)}>
                    Make first choice
                  </Menu.Item>
                )}
                {player && (
                  <Menu.Item value="profile" asChild>
                    <Link to={`/players/${planned.uid}`}>Open profile</Link>
                  </Menu.Item>
                )}
                {mismatch && (
                  <Menu.Item value="mismatch" onSelect={() => setShowMismatch(true)}>
                    Out of position…
                  </Menu.Item>
                )}
                <Menu.Item value="remove" onSelect={() => remove(slot.id, planned.uid)}>
                  Remove
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      {mismatch && effectivePlayer && (
        <MismatchDialog
          slot={slot}
          player={effectivePlayer}
          planned={planned}
          isOpen={showMismatch}
          onClose={() => setShowMismatch(false)}
        />
      )}
    </>
  );
}
