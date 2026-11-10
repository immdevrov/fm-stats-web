import { useEffect, useState } from "react";
import { HStack, Text, VStack } from "@chakra-ui/react";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";
import { MoneyInput } from "./MoneyInput";

export function PricingFields({ uid, player }: { uid: number; player: PlayerIdentity }) {
  const { annotations, setPricing } = usePlayerNotes();
  const annotation = annotations.get(uid);

  const [price, setPrice] = useState<number | undefined>(undefined);
  const [wageDemand, setWageDemand] = useState<number | undefined>(undefined);

  useEffect(() => {
    setPrice(annotation?.price); // eslint-disable-line react-hooks/set-state-in-effect
  }, [uid, annotation?.price]);

  useEffect(() => {
    setWageDemand(annotation?.wageDemand); // eslint-disable-line react-hooks/set-state-in-effect
  }, [uid, annotation?.wageDemand]);

  const commit = () => setPricing(uid, { price, wageDemand }, player);

  return (
    <VStack align="stretch" gap={3}>
      <HStack gap={3} align="start">
        <VStack align="stretch" gap={1} flex={1}>
          <Text fontSize="xs" fontWeight="medium" color="fg.muted">
            Price
          </Text>
          <MoneyInput size="sm" placeholder="e.g. 12m" value={price} onChange={setPrice} onBlur={commit} />
        </VStack>
        <VStack align="stretch" gap={1} flex={1}>
          <Text fontSize="xs" fontWeight="medium" color="fg.muted">
            Wage demand
          </Text>
          <MoneyInput size="sm" placeholder="e.g. 45k" value={wageDemand} onChange={setWageDemand} onBlur={commit} />
        </VStack>
      </HStack>
    </VStack>
  );
}
