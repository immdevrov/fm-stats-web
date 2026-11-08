import { useState } from "react";
import { Button, HStack, Menu, Portal, Text } from "@chakra-ui/react";
import { ROLE_CONFIG } from "../roles";
import { useArchetypes } from "../contexts/ArchetypeContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { linkedListOf, validateArchetypeName } from "../utils/archetypes";
import { sameFilters } from "../utils/scouting-filters";
import type { Archetype, ScoutingFilters } from "../types/archetypes";
import { NameDialog } from "./ui/name-dialog";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { toaster } from "./ui/toaster";
import { LinkListDialog, type LinkListChoice } from "./LinkListDialog";

type PickerDialog =
  | { kind: "save-as" }
  | { kind: "rename"; archetype: Archetype }
  | { kind: "delete"; archetype: Archetype }
  | { kind: "discard"; target: Archetype }
  | { kind: "link"; archetype: Archetype };

interface ArchetypePickerProps {
  filters: ScoutingFilters;
  activeId: string | null;
  onApply: (archetype: Archetype) => void;
  onActiveChange: (id: string | null) => void;
}

export function ArchetypePicker({ filters, activeId, onApply, onActiveChange }: ArchetypePickerProps) {
  const { archetypes, isLoaded, create, update, rename, remove, setList } = useArchetypes();
  const { lists, createList, isLoaded: notesLoaded, loadError } = usePlayerNotes();
  const [dialog, setDialog] = useState<PickerDialog | null>(null);

  if (!isLoaded) return null;

  const active = archetypes.find((a) => a.id === activeId) ?? null;
  const modified = active !== null && !sameFilters(filters, active.filters);
  const notesReady = notesLoaded && !loadError;
  const linked = linkedListOf(active, lists, notesReady);

  const link = async (archetypeId: string, choice: LinkListChoice) => {
    if ("listId" in choice) {
      setList(archetypeId, choice.listId);
      return;
    }
    try {
      const list = await createList(choice.newName);
      setList(archetypeId, list.id);
    } catch {
      toaster.create({
        title: "List Not Created",
        description: "The list could not be created.",
        type: "error",
        duration: 3000,
      });
    }
  };

  const groups = [...ROLE_CONFIG]
    .sort((a, b) => Number(b.key === filters.roleKey) - Number(a.key === filters.roleKey))
    .map((rc) => ({ role: rc, items: archetypes.filter((a) => a.filters.roleKey === rc.key) }))
    .filter((group) => group.items.length > 0);

  const choose = (target: Archetype) => {
    if (active && target.id === active.id && !modified) return;
    if (modified) setDialog({ kind: "discard", target });
    else onApply(target);
  };

  const saveAsNew = (name: string) => onActiveChange(create(name, filters, linked?.id).id);

  return (
    <HStack gap={2}>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline">
            {active ? active.name : "No archetype"}
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              {groups.length === 0 && (
                <Menu.Item value="empty" disabled>
                  No archetypes saved yet
                </Menu.Item>
              )}
              {groups.map((group) => (
                <Menu.ItemGroup key={group.role.key}>
                  <Menu.ItemGroupLabel>{group.role.name}</Menu.ItemGroupLabel>
                  {group.items.map((archetype) => (
                    <Menu.Item key={archetype.id} value={archetype.id} onSelect={() => choose(archetype)}>
                      {archetype.name}
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
          Save as archetype
        </Button>
      )}

      {linked && (
        <Text fontSize="sm" color="fg.muted">
          → {linked.name}
        </Text>
      )}

      {active && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button size="sm" variant="ghost" aria-label="Archetype actions">
              …
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {notesReady && !linked && (
                  <Menu.Item value="link" onSelect={() => setDialog({ kind: "link", archetype: active })}>
                    Link list…
                  </Menu.Item>
                )}
                {linked && (
                  <>
                    <Menu.Item value="link" onSelect={() => setDialog({ kind: "link", archetype: active })}>
                      Change list…
                    </Menu.Item>
                    <Menu.Item value="unlink" onSelect={() => setList(active.id, null)}>
                      Unlink
                    </Menu.Item>
                  </>
                )}
                <Menu.Item value="rename" onSelect={() => setDialog({ kind: "rename", archetype: active })}>
                  Rename
                </Menu.Item>
                <Menu.Item value="delete" onSelect={() => setDialog({ kind: "delete", archetype: active })}>
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
        title={linked ? "Change list" : "Link list"}
        lists={lists}
        initialListId={linked?.id ?? null}
        defaultNewName={dialog?.kind === "link" ? dialog.archetype.name : ""}
        onSubmit={(choice) => dialog?.kind === "link" && link(dialog.archetype.id, choice)}
        onClose={() => setDialog(null)}
      />
      <NameDialog
        isOpen={dialog?.kind === "save-as"}
        title={active ? "Save as new archetype" : "Save as archetype"}
        initialValue=""
        validate={(name) => validateArchetypeName(name, archetypes)}
        onSubmit={saveAsNew}
        onClose={() => setDialog(null)}
      />
      <NameDialog
        isOpen={dialog?.kind === "rename"}
        title="Rename archetype"
        initialValue={dialog?.kind === "rename" ? dialog.archetype.name : ""}
        validate={(name) =>
          validateArchetypeName(name, archetypes, dialog?.kind === "rename" ? dialog.archetype.id : undefined)
        }
        onSubmit={(name) => dialog?.kind === "rename" && rename(dialog.archetype.id, name)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        isOpen={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          remove(dialog.archetype.id);
          onActiveChange(null);
          setDialog(null);
        }}
        title="Delete archetype"
        message={
          dialog?.kind === "delete"
            ? `Delete “${dialog.archetype.name}”? Your current filters stay as they are.`
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
