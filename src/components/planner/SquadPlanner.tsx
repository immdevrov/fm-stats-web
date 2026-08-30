import { Button, Heading, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import type { Player } from "../../types/types";
import { FORMATIONS, getFormation } from "../../formations";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { PlannerBoard } from "./PlannerBoard";
import { PlannerToolbar } from "./PlannerToolbar";

export function SquadPlanner({ club }: { club: string; players: Player[] }) {
  const { plan, isLoaded, setFormation } = useSquadPlan();

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
      <PlannerBoard formation={formation} />
    </VStack>
  );
}
