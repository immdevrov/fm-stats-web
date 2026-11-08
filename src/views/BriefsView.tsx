import { useMemo, useState } from "react";
import { Box, Button, Container, Heading, Spinner, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { ROLE_CONFIG } from "../roles";
import { useBriefs } from "../contexts/BriefContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLinkBriefList } from "../hooks/useLinkBriefList";
import { linkedListOf, roleLabel } from "../utils/briefs";
import { LoadErrorNotice } from "../components/LoadErrorNotice";
import { LinkListDialog } from "../components/LinkListDialog";
import { Table, type Column } from "../components/ui/table";
import type { Brief } from "../types/briefs";

interface BriefRow extends Record<string, unknown> {
  brief: Brief;
  name: string;
  role: string;
  listName: string | null;
  candidates: number | null;
}

export function BriefsView() {
  useDocumentTitle("Briefs");
  const { briefs, isLoaded, loadError } = useBriefs();
  const { lists, isLoaded: notesLoaded, loadError: notesError } = usePlayerNotes();
  const link = useLinkBriefList();
  const [linking, setLinking] = useState<Brief | null>(null);

  const rows: BriefRow[] = useMemo(() => {
    const roleIndex = (key: string) => ROLE_CONFIG.findIndex((rc) => rc.key === key);
    return [...briefs]
      .sort(
        (a, b) =>
          roleIndex(a.filters.roleKey) - roleIndex(b.filters.roleKey) ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      )
      .map((brief) => {
        const list = linkedListOf(brief, lists, true);
        return {
          brief,
          name: brief.name,
          role: roleLabel(brief.filters.roleKey, brief.filters.side),
          listName: list?.name ?? null,
          candidates: list ? list.uids.length : null,
        };
      });
  }, [briefs, lists]);

  const columns: Column<BriefRow>[] = [
    {
      key: "name",
      header: "Brief",
      sortable: false,
      render: (_value, row) => (
        <Text asChild color="glaucous.500" _hover={{ textDecoration: "underline" }}>
          <Link to={`/briefs/${row.brief.id}`}>{row.name}</Link>
        </Text>
      ),
    },
    { key: "role", header: "Role", sortable: false },
    {
      key: "listName",
      header: "Shortlist",
      sortable: false,
      render: (_value, row) =>
        row.listName ?? (
          <Button size="xs" variant="outline" onClick={() => setLinking(row.brief)}>
            Link list
          </Button>
        ),
    },
    {
      key: "candidates",
      header: "Candidates",
      sortable: false,
      render: (value) => (value === null ? "" : String(value)),
    },
  ];

  if (loadError) return <LoadErrorNotice what="Briefs" error={loadError} />;
  if (notesError) return <LoadErrorNotice what="Lists" error={notesError} />;

  if (!isLoaded || !notesLoaded) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.lg">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading briefs...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.lg">
        <VStack gap={6} align="stretch">
          <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
            Briefs
          </Heading>
          {rows.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No briefs yet — save a search as a brief on{" "}
              <Text asChild as="span" color="glaucous.500">
                <Link to="/scouting">Scouting</Link>
              </Text>
            </Text>
          ) : (
            <Table data={rows} columns={columns} />
          )}
        </VStack>
      </Container>
      <LinkListDialog
        isOpen={linking !== null}
        title={linking ? `Link list to “${linking.name}”` : ""}
        lists={lists}
        initialListId={null}
        defaultNewName={linking?.name ?? ""}
        onSubmit={(choice) => linking && link(linking.id, choice)}
        onClose={() => setLinking(null)}
      />
    </Box>
  );
}
