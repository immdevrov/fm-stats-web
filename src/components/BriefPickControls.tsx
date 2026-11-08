import { useRef, useState } from "react";
import { Badge, chakra, IconButton, Input, Menu, Portal } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
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
