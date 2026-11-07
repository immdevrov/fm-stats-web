import { useEffect, useMemo } from "react";
import { Button, Heading, HStack, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import type { Player } from "../../types/types";
import { PRESETS, boardSlots } from "../../formations";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { useRoster, useSnapshots } from "../../contexts/SnapshotContext";
import { PlannerBoard } from "./PlannerBoard";
import { PlannerToolbar } from "./PlannerToolbar";
import { CandidatePanel } from "./CandidatePanel";
import { PlannerDnd } from "./PlannerDnd";

export function SquadPlanner({ club, players }: { club: string; players: Player[] }) {
  const { lists, annotations } = usePlayerNotes();
  const { plan, isLoaded, applyPreset, refreshSnapshots } = useSquadPlan();
  const { players: allPlayers } = useRoster();
  const { isNewest } = useSnapshots();

  const listed = useMemo(() => {
    if (!allPlayers) return [];
    const uids = new Set(lists.flatMap((list) => list.uids));
    return allPlayers.filter(
      (player) =>
        uids.has(player.UID) && !(isNewest && annotations.get(player.UID)?.transfer === "out")
    );
  }, [allPlayers, lists, annotations, isNewest]);

  const presentUids = useMemo(
    () => new Set([...players, ...listed].map((player) => player.UID)),
    [players, listed]
  );

  const slots = useMemo(() => (plan ? boardSlots(plan) : []), [plan]);

  const byUid = useMemo(
    () => new Map((allPlayers ?? []).map((player) => [player.UID, player])),
    [allPlayers]
  );

  useEffect(() => {
    // Only the newest snapshot may write back name and club: browsing 2033 must not persist 2033 clubs.
    if (!isLoaded || !plan || !allPlayers || !isNewest) return;
    refreshSnapshots(
      new Map(allPlayers.map((p) => [p.UID, { name: p.Name, club: p.Club }]))
    );
  }, [isLoaded, plan, allPlayers, isNewest, refreshSnapshots]);

  if (!isLoaded || allPlayers === null) {
    return <Spinner size="lg" colorPalette="glaucous" alignSelf="center" />;
  }

  if (!plan) {
    return (
      <VStack align="stretch" gap={5}>
        <Heading size="lg" color="fg.emphasized">
          Which shape are you planning?
        </Heading>
        <Text color="fg.muted">
          {club}&rsquo;s board starts empty. Every card is placed by hand.
        </Text>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
          {PRESETS.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              colorPalette="glaucous"
              onClick={() => applyPreset(option.id)}
            >
              {option.name}
            </Button>
          ))}
        </SimpleGrid>
      </VStack>
    );
  }


  return (
    <VStack align="stretch" gap={4}>
      <PlannerToolbar slots={slots} presentUids={presentUids} />
      <PlannerDnd slots={slots} byUid={byUid}>
        <HStack align="stretch" gap={6}>
          <PlannerBoard
            slots={slots}
            squad={players}
            listed={listed}
            byUid={byUid}
            presentUids={presentUids}
          />
          <CandidatePanel squad={players} listed={listed} />
        </HStack>
      </PlannerDnd>
    </VStack>
  );
}
