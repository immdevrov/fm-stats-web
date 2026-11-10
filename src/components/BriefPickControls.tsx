import { useRef, useState } from "react";
import { Badge, chakra, IconButton, Menu, Portal, Textarea } from "@chakra-ui/react";
import { LuNotebookPen, LuX } from "react-icons/lu";
import { useNotesDrawer } from "../contexts/NotesDrawerContext";
import { Tooltip } from "./ui/tooltip";
import { toaster } from "./ui/toaster";
import { useBriefs } from "../contexts/BriefContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import type { Brief, Grade } from "../types/briefs";
import type { PlayerList } from "../types/annotations";
import type { BriefRow } from "../utils/brief-rows";

const NO_GRADE = "none";

const GRADES: { value: Grade | typeof NO_GRADE; label: string; meaning: string; palette: string }[] = [
  { value: "A", label: "A", meaning: "Sign him", palette: "green" },
  { value: "B", label: "B", meaning: "Solid fallback", palette: "yellow" },
  { value: "C", label: "C", meaning: "Only if the price is right", palette: "orange" },
  { value: NO_GRADE, label: "–", meaning: "No grade", palette: "gray" },
];

function GradeBadge({ value }: { value: Grade | typeof NO_GRADE }) {
  const grade = GRADES.find((g) => g.value === value) ?? GRADES[3];
  return (
    <Badge
      colorPalette={grade.palette}
      variant={value === NO_GRADE ? "outline" : "solid"}
      minW={6}
      justifyContent="center"
    >
      {grade.label}
    </Badge>
  );
}

export function GradeControl({ brief, list, row }: { brief: Brief; list: PlayerList; row: BriefRow }) {
  const { setGrade } = useBriefs();
  const current = row.grade ?? NO_GRADE;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <chakra.button aria-label={`Grade for ${row.name}`} borderRadius="sm" cursor="pointer">
          <GradeBadge value={current} />
        </chakra.button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup
              value={current}
              onValueChange={(e) =>
                setGrade(brief.id, list.uids, row.uid, e.value === NO_GRADE ? null : (e.value as Grade))
              }
            >
              {GRADES.map((g) => (
                <Menu.RadioItem key={g.value} value={g.value}>
                  <GradeBadge value={g.value} />
                  <Menu.ItemText>{g.meaning}</Menu.ItemText>
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

export function BriefNoteLine({ brief, row }: { brief: Brief; row: BriefRow }) {
  const { addNote, updateNote } = usePlayerNotes();
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  const label = `Brief note for ${row.name}`;
  const current = row.note?.text ?? "";

  if (editing) {
    const finish = (save: boolean, value: string) => {
      setEditing(false);
      const text = value.trim();
      if (!save || !text || text === current) return;
      const write = row.note
        ? updateNote(row.uid, row.note.id, text)
        : addNote(row.uid, { text, briefId: brief.id, briefName: brief.name }, row.identity);
      write.catch(() =>
        toaster.create({ title: "Note Not Saved", description: "Please try again.", type: "error", duration: 3000 })
      );
    };
    return (
      <Textarea
        size="xs"
        autoresize
        autoFocus
        rows={1}
        aria-label={label}
        defaultValue={current}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            cancelled.current = true;
            finish(true, e.currentTarget.value);
          } else if (e.key === "Escape") {
            cancelled.current = true;
            finish(false, "");
          }
        }}
        onBlur={(e) => {
          if (cancelled.current) return;
          finish(true, e.currentTarget.value);
        }}
      />
    );
  }

  return (
    <chakra.button
      aria-label={label}
      textAlign="start"
      fontSize="xs"
      color="fg.muted"
      lineClamp={1}
      opacity={row.note ? 1 : 0}
      _focusVisible={{ opacity: 1 }}
      _groupHover={{ opacity: 1 }}
      onClick={() => {
        cancelled.current = false;
        setEditing(true);
      }}
    >
      {row.note ? row.note.text : "Add note…"}
    </chakra.button>
  );
}

export function NotesButton({ brief, row }: { brief: Brief; row: BriefRow }) {
  const notesDrawer = useNotesDrawer();
  if (row.noteCount === 0) return null;
  const others = row.noteCount - (row.note ? 1 : 0);
  const tip = others === 0 ? "Notes" : others === 1 ? "1 other note" : `${others} other notes`;
  return (
    <Tooltip content={tip}>
      <IconButton
        size="2xs"
        variant="ghost"
        aria-label={`Notes for ${row.name}`}
        onClick={() =>
          notesDrawer.open({ uid: row.uid, name: row.name, identity: row.identity, briefId: brief.id })
        }
      >
        <LuNotebookPen />
      </IconButton>
    </Tooltip>
  );
}

export function RemoveMenu({ list, row }: { list: PlayerList; row: BriefRow }) {
  const { removeFromList, setUnwanted } = usePlayerNotes();
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton size="2xs" variant="ghost" aria-label={`Remove ${row.name}`}>
          <LuX />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="remove" onSelect={() => removeFromList(list.id, row.uid)}>
              Remove from shortlist
            </Menu.Item>
            <Menu.Item value="unwanted" onSelect={() => setUnwanted(row.uid, true, row.identity)}>
              Remove and mark unwanted
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
