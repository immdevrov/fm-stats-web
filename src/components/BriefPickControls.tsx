import { useRef, useState } from "react";
import { Button, chakra, HStack, IconButton, Input, Menu, Portal } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { useBriefs } from "../contexts/BriefContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import type { Brief, Grade } from "../types/briefs";
import type { PlayerList } from "../types/annotations";
import type { BriefRow } from "../utils/brief-rows";

const GRADES: { value: Grade | null; label: string; aria: string }[] = [
  { value: "A", label: "A", aria: "Grade A" },
  { value: "B", label: "B", aria: "Grade B" },
  { value: "C", label: "C", aria: "Grade C" },
  { value: null, label: "–", aria: "No grade" },
];

export function GradeControl({ brief, list, row }: { brief: Brief; list: PlayerList; row: BriefRow }) {
  const { setGrade } = useBriefs();
  return (
    <HStack gap={0.5}>
      {GRADES.map((g) => (
        <Button
          key={g.aria}
          size="2xs"
          minW={6}
          px={1}
          variant={row.grade === g.value ? "solid" : "ghost"}
          aria-label={g.aria}
          aria-pressed={row.grade === g.value}
          onClick={() => setGrade(brief.id, list.uids, row.uid, g.value)}
        >
          {g.label}
        </Button>
      ))}
    </HStack>
  );
}

export function VerdictLine({ brief, list, row }: { brief: Brief; list: PlayerList; row: BriefRow }) {
  const { setVerdict } = useBriefs();
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  const label = `Verdict for ${row.name}`;

  if (editing) {
    const finish = (save: boolean, value: string) => {
      setEditing(false);
      if (save && value.trim() !== (row.verdict ?? "")) setVerdict(brief.id, list.uids, row.uid, value);
    };
    return (
      <Input
        size="xs"
        autoFocus
        aria-label={label}
        defaultValue={row.verdict ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
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
      opacity={row.verdict ? 1 : 0}
      _focusVisible={{ opacity: 1 }}
      _groupHover={{ opacity: 1 }}
      onClick={() => {
        cancelled.current = false;
        setEditing(true);
      }}
    >
      {row.verdict ?? "Add verdict…"}
    </chakra.button>
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
