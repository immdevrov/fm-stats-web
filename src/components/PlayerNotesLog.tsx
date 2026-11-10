import { useState } from "react";
import { Button, HStack, IconButton, NativeSelect, Text, Textarea, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";
import { useBriefs } from "../contexts/BriefContext";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { toaster } from "./ui/toaster";
import { isoToDisplay } from "../utils/import-date";
import { noteBriefName } from "../utils/player-notes";
import type { PlayerNote } from "../types/annotations";

function failed(title: string) {
  return () => {
    toaster.create({ title, description: "Please try again.", type: "error", duration: 3000 });
  };
}

interface PlayerNotesLogProps {
  uid: number;
  player?: PlayerIdentity;
  defaultBriefId?: string;
}

export function PlayerNotesLog({ uid, player, defaultBriefId }: PlayerNotesLogProps) {
  const { annotations, addNote } = usePlayerNotes();
  const { briefs } = useBriefs();
  const [text, setText] = useState("");
  const [briefId, setBriefId] = useState(defaultBriefId ?? "");
  const notes = annotations.get(uid)?.notes ?? [];

  const add = () => {
    const brief = briefs.find((b) => b.id === briefId);
    addNote(uid, { text, ...(brief ? { briefId: brief.id, briefName: brief.name } : {}) }, player)
      .then(() => setText(""))
      .catch(failed("Note Not Added"));
  };

  return (
    <VStack align="stretch" gap={3}>
      <VStack align="stretch" gap={2}>
        <Textarea
          size="sm"
          autoresize
          aria-label="New note"
          placeholder="What do you think of him?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <HStack gap={2}>
          <NativeSelect.Root size="sm" flex={1}>
            <NativeSelect.Field
              aria-label="Brief"
              value={briefId}
              onChange={(e) => setBriefId(e.currentTarget.value)}
            >
              <option value="">No brief</option>
              {briefs.map((brief) => (
                <option key={brief.id} value={brief.id}>
                  {brief.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Button size="sm" colorPalette="glaucous" disabled={!text.trim()} onClick={add}>
            Add note
          </Button>
        </HStack>
      </VStack>

      {notes.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          No notes yet.
        </Text>
      ) : (
        <VStack align="stretch" gap={2}>
          {[...notes].reverse().map((note) => (
            <NoteEntry key={note.id} uid={uid} note={note} />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function NoteEntry({ uid, note }: { uid: number; note: PlayerNote }) {
  const { updateNote, deleteNote } = usePlayerNotes();
  const { briefs, isLoaded: briefsLoaded } = useBriefs();
  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const liveBrief = briefs.find((b) => b.id === note.briefId);
  const briefName = noteBriefName(note, briefs);

  const save = () => {
    if (draft !== null && draft.trim() && draft.trim() !== note.text) {
      updateNote(uid, note.id, draft).catch(failed("Note Not Saved"));
    }
    setDraft(null);
  };

  return (
    <VStack align="stretch" gap={1} borderWidth="1px" borderRadius="md" p={2}>
      <HStack gap={2} fontSize="xs" color="fg.muted">
        <Text>{note.date ? isoToDisplay(note.date) : "Undated"}</Text>
        {briefsLoaded &&
          briefName &&
          (liveBrief ? (
            <Link to={`/briefs/${liveBrief.id}`}>
              <Text color="glaucous.400" _hover={{ textDecoration: "underline" }}>
                {briefName}
              </Text>
            </Link>
          ) : (
            <Text>{briefName}</Text>
          ))}
        <HStack gap={0} ms="auto">
          <IconButton size="2xs" variant="ghost" aria-label="Edit note" onClick={() => setDraft(note.text)}>
            <LuPencil />
          </IconButton>
          <IconButton size="2xs" variant="ghost" aria-label="Delete note" onClick={() => setConfirming(true)}>
            <LuTrash2 />
          </IconButton>
        </HStack>
      </HStack>

      {draft === null ? (
        <Text fontSize="sm" whiteSpace="pre-wrap">
          {note.text}
        </Text>
      ) : (
        <VStack align="stretch" gap={2}>
          <Textarea
            size="sm"
            autoresize
            autoFocus
            aria-label="Edit note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <HStack gap={2} justify="end">
            <Button size="xs" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="xs" colorPalette="glaucous" onClick={save}>
              Save
            </Button>
          </HStack>
        </VStack>
      )}

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            await deleteNote(uid, note.id);
          } catch {
            failed("Note Not Deleted")();
          }
          setConfirming(false);
        }}
        title="Delete note?"
        message="This note will be removed for good."
        options={[{ label: "Delete note", value: "delete" }]}
      />
    </VStack>
  );
}
