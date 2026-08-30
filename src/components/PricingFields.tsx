import { useEffect, useState } from "react";
import { HStack, Input, Text, VStack } from "@chakra-ui/react";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";

function toNumber(value: string): number | undefined {
  const digits = value.replace(/[^\d]/g, "");
  return digits === "" ? undefined : Number(digits);
}

export function PricingFields({ uid, player }: { uid: number; player: PlayerIdentity }) {
  const { annotations, setPricing } = usePlayerNotes();
  const annotation = annotations.get(uid);

  const [price, setPrice] = useState("");
  const [wageDemand, setWageDemand] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setPrice(annotation?.price !== undefined ? String(annotation.price) : ""); // eslint-disable-line react-hooks/set-state-in-effect
  }, [uid, annotation?.price]);

  useEffect(() => {
    setWageDemand(annotation?.wageDemand !== undefined ? String(annotation.wageDemand) : ""); // eslint-disable-line react-hooks/set-state-in-effect
  }, [uid, annotation?.wageDemand]);

  useEffect(() => {
    setNote(annotation?.note ?? ""); // eslint-disable-line react-hooks/set-state-in-effect
  }, [uid, annotation?.note]);

  const commit = () =>
    setPricing(
      uid,
      { price: toNumber(price), wageDemand: toNumber(wageDemand), note: note.trim() || undefined },
      player
    );

  return (
    <VStack align="stretch" gap={3}>
      <HStack gap={3}>
        <VStack align="stretch" gap={1} flex={1}>
          <Text fontSize="xs" fontWeight="medium" color="fg.muted">
            Price
          </Text>
          <Input
            size="sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commit}
          />
        </VStack>
        <VStack align="stretch" gap={1} flex={1}>
          <Text fontSize="xs" fontWeight="medium" color="fg.muted">
            Wage demand
          </Text>
          <Input
            size="sm"
            value={wageDemand}
            onChange={(e) => setWageDemand(e.target.value)}
            onBlur={commit}
          />
        </VStack>
      </HStack>
      <VStack align="stretch" gap={1}>
        <Text fontSize="xs" fontWeight="medium" color="fg.muted">
          Note
        </Text>
        <Input
          size="sm"
          placeholder="Why he is on the list, or why he is not…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commit}
        />
      </VStack>
    </VStack>
  );
}
