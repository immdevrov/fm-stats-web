import { useEffect, useState } from "react";
import { Box, Button, Container, HStack, Heading, Spinner, Text, VStack } from "@chakra-ui/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { db } from "../services/db";
import { useBriefs } from "../contexts/BriefContext";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { useRoster } from "../contexts/SnapshotContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLinkBriefList } from "../hooks/useLinkBriefList";
import { linkedListOf } from "../utils/briefs";
import { briefCriteria, briefRoleConfig } from "../utils/brief-rows";
import { saveWorkingState } from "../utils/scouting-filters";
import { buildScoutingCohort, rankedLeagueSet } from "../utils/scouting-engine";
import { roleClassFor } from "../utils/scouting-columns";
import { LoadErrorNotice } from "../components/LoadErrorNotice";
import { RosterErrorNotice } from "../components/RosterErrorNotice";
import { LinkListDialog } from "../components/LinkListDialog";
import { BriefHeatTable } from "../components/BriefHeatTable";
import type { LeagueRanking } from "../types/types";

function InlineLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to}>
      <Text as="span" color="glaucous.400" _hover={{ textDecoration: "underline" }}>
        {children}
      </Text>
    </Link>
  );
}

export function BriefView() {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { briefs, isLoaded: briefsLoaded, loadError: briefsError } = useBriefs();
  const { lists, isLoaded: notesLoaded, loadError: notesError } = usePlayerNotes();
  const { players: roster, error: rosterError } = useRoster();
  const [rankings, setRankings] = useState<LeagueRanking[] | null>(null);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const link = useLinkBriefList();
  const [linking, setLinking] = useState(false);

  const brief = briefs.find((b) => b.id === briefId) ?? null;
  useDocumentTitle(brief ? `Brief: ${brief.name}` : "Brief");

  useEffect(() => {
    db.getLeagueRankings()
      .then(setRankings)
      .catch((err) => setRankingsError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (briefsError) return <LoadErrorNotice what="Briefs" error={briefsError} />;
  if (notesError) return <LoadErrorNotice what="Lists" error={notesError} />;
  if (rosterError) return <RosterErrorNotice error={rosterError} />;
  if (rankingsError) return <LoadErrorNotice what="League rankings" error={rankingsError} />;

  if (!briefsLoaded || !notesLoaded || roster === null || rankings === null) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.xl">
          <VStack gap={8}>
            <Spinner size="lg" colorPalette="glaucous" />
            <Text color="fg.muted">Loading brief...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (!brief) {
    return (
      <Box minH="100vh" p={8}>
        <Container maxW="container.xl">
          <VStack gap={4}>
            <Heading size="xl">Brief not found</Heading>
            <InlineLink to="/briefs">Back to briefs</InlineLink>
          </VStack>
        </Container>
      </Box>
    );
  }

  const list = linkedListOf(brief, lists, notesLoaded);
  const hasRankedLeagues = rankedLeagueSet(rankings).size > 0;
  const emptyCohort =
    hasRankedLeagues &&
    buildScoutingCohort(
      roster,
      roleClassFor(briefRoleConfig(brief), brief.filters.side),
      rankings
    ).length === 0;

  const openInScouting = () => {
    saveWorkingState({ filters: brief.filters, activeBriefId: brief.id });
    navigate("/scouting");
  };

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.xl">
        <VStack gap={6} align="stretch">
          <HStack justify="space-between" align="start" gap={4}>
            <VStack align="start" gap={1}>
              <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
                {brief.name}
              </Heading>
              <Text color="fg.muted">{briefCriteria(brief).join(" · ")}</Text>
            </VStack>
            <Button size="sm" variant="outline" onClick={openInScouting}>
              Open in scouting
            </Button>
          </HStack>

          {emptyCohort && (
            <Text color="fg.muted">
              No players of this role in ranked leagues with 900+ minutes.
            </Text>
          )}

          {!hasRankedLeagues && (
            <Text color="fg.muted">
              No leagues are ranked yet. Briefs only rank players in ranked leagues — rank them on{" "}
              <InlineLink to="/leagues">Leagues</InlineLink>.
            </Text>
          )}

          {!list ? (
            <VStack gap={3}>
              <Text color="fg.muted">This brief has no shortlist yet</Text>
              <Button size="sm" variant="outline" onClick={() => setLinking(true)}>
                Link list
              </Button>
            </VStack>
          ) : list.uids.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              No players on “{list.name}” yet — pin them from{" "}
              <InlineLink to="/scouting">Scouting</InlineLink>
            </Text>
          ) : (
            <BriefHeatTable brief={brief} list={list} roster={roster} rankings={rankings} />
          )}
        </VStack>
      </Container>
      <LinkListDialog
        isOpen={linking}
        title={`Link list to “${brief.name}”`}
        lists={lists}
        initialListId={null}
        defaultNewName={brief.name}
        onSubmit={(choice) => link(brief.id, choice)}
        onClose={() => setLinking(false)}
      />
    </Box>
  );
}
