import { useEffect, useMemo, useState } from "react";
import { Button, Heading, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import type { Player } from "../../types/types";
import { FORMATIONS, getFormation } from "../../formations";
import { db } from "../../services/db";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { PlannerBoard } from "./PlannerBoard";
import { PlannerToolbar } from "./PlannerToolbar";

export function SquadPlanner({ club, players }: { club: string; players: Player[] }) {
  const { lists } = usePlayerNotes();
  const { plan, isLoaded, setFormation, refreshSnapshots } = useSquadPlan();
  const [allPlayers, setAllPlayers] = useState<Player[] | null>(null);

  useEffect(() => {
    db.getAllPlayers().then(setAllPlayers);
  }, []);

  const listed = useMemo(() => {
    if (!allPlayers) return [];
    const uids = new Set(lists.flatMap((list) => list.uids));
    return allPlayers.filter((player) => uids.has(player.UID));
  }, [allPlayers, lists]);

  useEffect(() => {
    if (!isLoaded || !plan || !allPlayers) return;
    refreshSnapshots(
      new Map(allPlayers.map((p) => [p.UID, { name: p.Name, club: p.Club }]))
    );
  }, [isLoaded, plan, allPlayers, refreshSnapshots]);

  if (!isLoaded) {
    return <Spinner size="lg" colorPalette="glaucous" alignSelf="center" />;
  }

  const formation = plan ? getFormation(plan.formationId) : undefined;

  if (!formation) {
    return (
      <VStack align="stretch" gap={5}>
        <Heading size="lg" color="fg.emphasized">
          Which shape are you planning?
        </Heading>
        <Text color="fg.muted">
          {club}&rsquo;s board starts empty. Every card is placed by hand.
        </Text>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
          {FORMATIONS.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              colorPalette="glaucous"
              onClick={() => setFormation(option.id)}
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
      <PlannerToolbar formation={formation} />
      <PlannerBoard formation={formation} squad={players} listed={listed} />
    </VStack>
  );
}
