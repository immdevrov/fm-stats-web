import { useState } from "react";
import { Button, Checkbox, HStack, Menu, Portal, Text } from "@chakra-ui/react";
import { ROLE_CONFIG } from "../roles";
import { useBriefs } from "../contexts/BriefContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { linkedListOf, validateBriefName } from "../utils/briefs";
import { sameFilters } from "../utils/scouting-filters";
import type { Brief, ScoutingFilters } from "../types/briefs";
import { NameDialog } from "./ui/name-dialog";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { LinkListDialog } from "./LinkListDialog";
import { useLinkBriefList } from "../hooks/useLinkBriefList";

type PickerDialog =
  | { kind: "save-as" }
  | { kind: "rename"; brief: Brief }
  | { kind: "delete"; brief: Brief }
  | { kind: "discard"; target: Brief }
  | { kind: "link"; brief: Brief };

interface BriefPickerProps {
  filters: ScoutingFilters;
  activeId: string | null;
  onApply: (brief: Brief) => void;
  onActiveChange: (id: string | null) => void;
  shortlistOnly: boolean;
  onShortlistOnlyChange: (value: boolean) => void;
}

export function BriefPicker({
  filters,
  activeId,
  onApply,
  onActiveChange,
  shortlistOnly,
  onShortlistOnlyChange,
}: BriefPickerProps) {
  const { briefs, isLoaded, create, update, rename, remove, setList } = useBriefs();
  const { lists, isLoaded: notesLoaded, loadError } = usePlayerNotes();
  const link = useLinkBriefList();
  const [dialog, setDialog] = useState<PickerDialog | null>(null);

  if (!isLoaded) return null;

  const active = briefs.find((a) => a.id === activeId) ?? null;
  const modified = active !== null && !sameFilters(filters, active.filters);
  const notesReady = notesLoaded && !loadError;
  const linked = linkedListOf(active, lists, notesReady);
  const dialogLinked = dialog?.kind === "link" ? linkedListOf(dialog.brief, lists, notesReady) : null;

  const groups = [...ROLE_CONFIG]
    .sort((a, b) => Number(b.key === filters.roleKey) - Number(a.key === filters.roleKey))
    .map((rc) => ({ role: rc, items: briefs.filter((a) => a.filters.roleKey === rc.key) }))
    .filter((group) => group.items.length > 0);

  const choose = (target: Brief) => {
    if (active && target.id === active.id && !modified) return;
    if (modified) setDialog({ kind: "discard", target });
    else onApply(target);
  };

  const saveAsNew = (name: string) => onActiveChange(create(name, filters, active?.listId).id);

  return (
    <HStack gap={2}>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline">
            {active ? active.name : "No brief"}
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              {groups.length === 0 && (
                <Menu.Item value="empty" disabled>
                  No briefs saved yet
                </Menu.Item>
              )}
              {groups.map((group) => (
                <Menu.ItemGroup key={group.role.key}>
                  <Menu.ItemGroupLabel>{group.role.name}</Menu.ItemGroupLabel>
                  {group.items.map((brief) => (
                    <Menu.Item key={brief.id} value={brief.id} onSelect={() => choose(brief)}>
                      {brief.name}
                    </Menu.Item>
                  ))}
                </Menu.ItemGroup>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {!active && (
        <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "save-as" })}>
          Save as brief
        </Button>
      )}

      {linked && (
        <Text fontSize="sm" color="fg.muted">
          → {linked.name}
        </Text>
      )}
      {linked && (
        <Checkbox.Root
          size="sm"
          checked={shortlistOnly}
          onCheckedChange={(e) => onShortlistOnlyChange(e.checked === true)}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>Shortlist only</Checkbox.Label>
        </Checkbox.Root>
      )}

      {active && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="sm" variant="ghost" aria-label="Brief actions">
              …
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {notesReady && !linked && (
                  <Menu.Item value="link" onSelect={() => setDialog({ kind: "link", brief: active })}>
                    Link list…
                  </Menu.Item>
                )}
                {linked && (
                  <>
                    <Menu.Item value="link" onSelect={() => setDialog({ kind: "link", brief: active })}>
                      Change list…
                    </Menu.Item>
                    <Menu.Item value="unlink" onSelect={() => setList(active.id, null)}>
                      Unlink
                    </Menu.Item>
                  </>
                )}
                <Menu.Item value="rename" onSelect={() => setDialog({ kind: "rename", brief: active })}>
                  Rename
                </Menu.Item>
                <Menu.Item value="delete" onSelect={() => setDialog({ kind: "delete", brief: active })}>
                  Delete
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}

      {active && modified && (
        <>
          <Text fontSize="sm" color="fg.muted" fontStyle="italic">
            modified
          </Text>
          <Button size="sm" variant="ghost" onClick={() => update(active.id, filters)}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "save-as" })}>
            Save as new
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onApply(active)}>
            Revert
          </Button>
        </>
      )}

      <LinkListDialog
        isOpen={dialog?.kind === "link"}
        title={dialogLinked ? "Change list" : "Link list"}
        lists={lists}
        initialListId={dialogLinked?.id ?? null}
        defaultNewName={dialog?.kind === "link" ? dialog.brief.name : ""}
        onSubmit={(choice) => dialog?.kind === "link" && link(dialog.brief.id, choice)}
        onClose={() => setDialog(null)}
      />
      <NameDialog
        isOpen={dialog?.kind === "save-as"}
        title={active ? "Save as new brief" : "Save as brief"}
        initialValue=""
        validate={(name) => validateBriefName(name, briefs)}
        onSubmit={saveAsNew}
        onClose={() => setDialog(null)}
      />
      <NameDialog
        isOpen={dialog?.kind === "rename"}
        title="Rename brief"
        initialValue={dialog?.kind === "rename" ? dialog.brief.name : ""}
        validate={(name) =>
          validateBriefName(name, briefs, dialog?.kind === "rename" ? dialog.brief.id : undefined)
        }
        onSubmit={(name) => dialog?.kind === "rename" && rename(dialog.brief.id, name)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        isOpen={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          remove(dialog.brief.id);
          onActiveChange(null);
          setDialog(null);
        }}
        title="Delete brief"
        message={
          dialog?.kind === "delete"
            ? `Delete “${dialog.brief.name}”? Your current filters stay as they are.`
            : ""
        }
        options={[{ label: "Delete", value: "delete" }]}
      />
      <ConfirmDialog
        isOpen={dialog?.kind === "discard"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind !== "discard") return;
          onApply(dialog.target);
          setDialog(null);
        }}
        title="Discard changes?"
        message={active ? `Your changes to “${active.name}” are not saved.` : ""}
        options={[{ label: "Discard", value: "discard" }]}
      />
    </HStack>
  );
}
