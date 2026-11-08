import { IconButton } from "@chakra-ui/react";
import { LuPin } from "react-icons/lu";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";

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
  const pinned = lists.find((list) => list.id === listId)?.uids.includes(uid) === true;

  return (
    <IconButton
      size="2xs"
      variant={pinned ? "solid" : "ghost"}
      colorPalette={pinned ? "glaucous" : undefined}
      aria-label={`Pin ${player.Name}`}
      aria-pressed={pinned}
      disabled={isUnwanted(uid)}
      onClick={(e) => {
        e.stopPropagation();
        if (pinned) removeFromList(listId, uid);
        else addToList(listId, uid, player);
      }}
    >
      <LuPin />
    </IconButton>
  );
}
