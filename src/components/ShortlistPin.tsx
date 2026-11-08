import { Box, IconButton } from "@chakra-ui/react";
import { LuPin } from "react-icons/lu";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";
import { Tooltip } from "./ui/tooltip";

export function ShortlistPin({
  listId,
  uid,
  player,
}: {
  listId: string;
  uid: number;
  player: PlayerIdentity;
}) {
  const { lists, addToList, removeFromList, isUnwanted } = usePlayerNotes();
  const list = lists.find((l) => l.id === listId);
  const pinned = list?.uids.includes(uid) === true;
  const unwanted = isUnwanted(uid);
  const hint = unwanted
    ? "Unwanted players can't be shortlisted"
    : pinned
      ? `Remove from ${list?.name}`
      : `Add to ${list?.name}`;

  return (
    <Tooltip content={hint}>
      <Box as="span" display="inline-flex">
        <IconButton
          size="2xs"
          variant={pinned ? "solid" : "ghost"}
          colorPalette={pinned ? "glaucous" : undefined}
          aria-label={`Pin ${player.Name}`}
          aria-pressed={pinned}
          disabled={unwanted}
          onClick={(e) => {
            e.stopPropagation();
            if (pinned) removeFromList(listId, uid);
            else addToList(listId, uid, player);
          }}
        >
          <LuPin />
        </IconButton>
      </Box>
    </Tooltip>
  );
}
