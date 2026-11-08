import { useCallback } from "react";
import { useBriefs } from "../contexts/BriefContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { toaster } from "../components/ui/toaster";
import type { LinkListChoice } from "../components/LinkListDialog";

export function useLinkBriefList() {
  const { setList } = useBriefs();
  const { createList } = usePlayerNotes();

  return useCallback(
    async (briefId: string, choice: LinkListChoice) => {
      if ("listId" in choice) {
        setList(briefId, choice.listId);
        return;
      }
      try {
        const list = await createList(choice.newName);
        setList(briefId, list.id);
      } catch {
        toaster.create({
          title: "List Not Created",
          description: "The list could not be created.",
          type: "error",
          duration: 3000,
        });
      }
    },
    [setList, createList]
  );
}
