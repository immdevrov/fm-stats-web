import { HStack, Text, Badge } from "@chakra-ui/react";
import { Tooltip } from "./ui/tooltip";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { useBriefs } from "../contexts/BriefContext";
import { latestNote, noteSummary } from "../utils/player-notes";

export function PlayerStatusBadge({ uid }: { uid: number }) {
  const { annotations, listsFor } = usePlayerNotes();
  const unwanted = annotations.get(uid)?.unwanted === true;
  const { briefs } = useBriefs();
  const note = noteSummary(latestNote(annotations.get(uid)?.notes), briefs);
  const memberships = listsFor(uid);
  const transfer = annotations.get(uid)?.transfer;

  if (transfer) {
    const label = transfer === "in" ? "Arriving" : "Leaving";
    return (
      <Tooltip content={note ? `${label} — ${note}` : label}>
        <Text
          as="span"
          color={transfer === "in" ? "glaucous.500" : "spicyPaprika.500"}
          fontSize="md"
          lineHeight="1"
          aria-label={label}
        >
          {transfer === "in" ? "↘" : "↗"}
        </Text>
      </Tooltip>
    );
  }

  if (unwanted) {
    return (
      <Tooltip content={note ? `Unwanted — ${note}` : "Unwanted"}>
        <Text as="span" color="spicyPaprika.500" fontSize="md" lineHeight="1">
          &#8856;
        </Text>
      </Tooltip>
    );
  }

  if (memberships.length > 0) {
    return (
      <Tooltip content={memberships.map((list) => list.name).join(", ")}>
        <HStack gap={1}>
          <Text as="span" color="glaucous.500" fontSize="md" lineHeight="1">
            &#9733;
          </Text>
          <Badge colorPalette="glaucous" variant="subtle" size="sm">
            {memberships.length}
          </Badge>
        </HStack>
      </Tooltip>
    );
  }

  return (
    <Tooltip content="Not on any list">
      <Text as="span" color="fg.muted" fontSize="md" lineHeight="1">
        &#9734;
      </Text>
    </Tooltip>
  );
}
