import { Text } from "@chakra-ui/react";
import type { Player } from "../../types/types";

export function SquadPlanner({ club, players }: { club: string; players: Player[] }) {
  return (
    <Text color="fg.muted">
      Planner for {club}: {players.length} squad players.
    </Text>
  );
}
