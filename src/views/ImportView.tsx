import { Container, Heading, VStack, Box, Text, Spinner, Button, HStack } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { FileInput } from "../components/ui/file-input";
import { SnapshotTable } from "../components/SnapshotTable";
import { findMissingColumns, parseHtmlTable, transformPlayerStats } from "../parser/html-parser";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { ImportSaveDialog } from "../components/ui/import-save-dialog";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { useSnapshots } from "../contexts/SnapshotContext";
import { useMyTeam } from "../contexts/MyTeamContext";
import { useSquadPlan } from "../contexts/SquadPlanContext";
import { useCompare } from "../contexts/CompareContext";
import type { Player } from "../types/types";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "an unknown error occurred";
}

export function ImportView() {
  useDocumentTitle("Import");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    count: number;
    message: string;
  } | null>(null);
  const { refresh: notesRefresh } = usePlayerNotes();
  const {
    snapshots,
    refresh,
    setActive,
    isLoaded: snapshotsLoaded,
    loadError: snapshotsError,
  } = useSnapshots();
  const { clearMyClub } = useMyTeam();
  const { clearPlan } = useSquadPlan();
  const { clearAll: clearCompareList } = useCompare();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ written: number; total: number } | null>(null);

  // Store pending import data while dialog is open
  const pendingPlayers = useRef<Player[] | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);
    try {
      const rawRecords = parseHtmlTable(await file.text());
      if (rawRecords.length === 0) {
        throw new Error("Could not extract table data from the HTML file.");
      }

      const missing = findMissingColumns(Object.keys(rawRecords[0]));
      if (missing.length > 0) {
        throw new Error(
          `This export is missing ${missing.length} column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Re-run the search in Football Manager with the full column set.`
        );
      }

      const players = transformPlayerStats(rawRecords);
      if (players.length === 0) throw new Error("No player data found in the file.");

      pendingPlayers.current = players;
      setIsImporting(false);
      setPendingName(file.name);
    } catch (error) {
      handleImportError(error);
    }
  };

  const performImport = async (choice: {
    mode: "same" | "new";
    date: string;
    replaces: string[];
  }) => {
    const players = pendingPlayers.current;
    if (!players) return;
    try {
      setIsImporting(true);
      await navigator.storage?.persist?.().catch(() => undefined);

      if (choice.mode === "new") {
        try {
          await db.clearAllSnapshots();
          await db.clearLeagueRankings();
          await db.clearListsAndAnnotations(true);
          await db.clearCompareList();
        } catch (error) {
          throw new Error(
            `Erasing the old save did not finish (${errorText(error)}). Some of it may still be there and some may be gone — check My Team, snapshots and lists before importing again.`
          );
        }
        clearMyClub();
        clearPlan();
        clearCompareList();
      }

      let id: string;
      try {
        id = await db.createSnapshot(players, { date: choice.date }, (written, total) =>
          setProgress({ written, total })
        );
      } catch (error) {
        throw choice.mode === "new"
          ? new Error(
              `The old save was erased, but the new import could not be saved (${errorText(error)}). You have no snapshots — try importing again.`
            )
          : new Error(`Import failed (${errorText(error)}). Nothing was changed.`);
      }

      for (const replacedId of choice.mode === "same" ? choice.replaces : []) {
        try {
          await db.deleteSnapshot(replacedId);
        } catch (error) {
          toaster.create({
            title: "Old Snapshot Left Behind",
            description: `The new snapshot saved, but the one it was meant to replace could not be removed (${errorText(error)}). Delete it manually from the snapshot list.`,
            type: "warning",
            duration: 8000,
          });
        }
      }

      await refresh();
      setActive(id);
      await notesRefresh();

      // Show success feedback
      const successMessage = `Imported ${players.length} player${players.length !== 1 ? "s" : ""}`;
      setImportStatus({ success: true, count: players.length, message: successMessage });

      toaster.create({
        title: "Import Successful",
        description: successMessage,
        type: "success",
        duration: 5000,
      });
    } catch (error) {
      handleImportError(error);
    } finally {
      setIsImporting(false);
      setProgress(null);
      pendingPlayers.current = null;
    }
  };

  const handleImportError = (error: unknown) => {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred during import.";

    setImportStatus({
      success: false,
      count: 0,
      message: errorMessage,
    });

    toaster.create({
      title: "Import Failed",
      description: errorMessage,
      type: "error",
      duration: 7000,
    });

    console.error("Error processing file:", error);
    setIsImporting(false);
  };

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.md">
        <VStack gap={8} align="stretch">
          <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
            Import Player Data
          </Heading>

          {isImporting && (
            <VStack gap={2}>
              <Spinner size="lg" colorPalette="glaucous" />
              <Text color="fg.muted">
                {progress
                  ? `Saving ${progress.written.toLocaleString()} of ${progress.total.toLocaleString()} players…`
                  : "Processing file…"}
              </Text>
            </VStack>
          )}

          {importStatus && !isImporting && (
            <Box
              p={4}
              borderRadius="md"
              bg={importStatus.success ? "green.500" : "red.500"}
              color="white"
            >
              <Text fontWeight="medium">{importStatus.message}</Text>
            </Box>
          )}

          <SnapshotTable />

          <FileInput onFileSelect={handleFileSelect} accept=".html,.htm" disabled={isImporting} />

          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Select an HTML file exported from Football Manager 24. The player data will be saved to
            your browser's local storage.
          </Text>

          <HStack gap={2} justify="center">
            <Button
              variant="outline"
              size="sm"
              colorPalette="red"
              onClick={async () => {
                try {
                  await db.clearAllCustomPositions();
                  await notesRefresh();
                  toaster.create({
                    title: "Custom Positions Cleared",
                    description: "All custom position overrides have been removed.",
                    type: "success",
                    duration: 5000,
                  });
                } catch (error) {
                  toaster.create({
                    title: "Failed to Clear Custom Positions",
                    description:
                      error instanceof Error ? error.message : "An unknown error occurred.",
                    type: "error",
                    duration: 7000,
                  });
                }
              }}
            >
              Clear All Custom Positions
            </Button>

            <Button
              variant="outline"
              size="sm"
              colorPalette="red"
              onClick={async () => {
                try {
                  await db.clearListsAndAnnotations(false);
                  await notesRefresh();
                  toaster.create({
                    title: "Lists Cleared",
                    description: "All lists, prices, notes and unwanted flags have been removed.",
                    type: "success",
                    duration: 5000,
                  });
                } catch (error) {
                  toaster.create({
                    title: "Failed to Clear Lists",
                    description:
                      error instanceof Error ? error.message : "An unknown error occurred.",
                    type: "error",
                    duration: 7000,
                  });
                }
              }}
            >
              Clear All Lists & Notes
            </Button>
          </HStack>
        </VStack>
      </Container>

      <ImportSaveDialog
        isOpen={pendingName !== null}
        filename={pendingName ?? ""}
        snapshots={snapshots}
        snapshotsLoaded={snapshotsLoaded}
        snapshotsError={snapshotsError}
        onClose={() => {
          setPendingName(null);
          pendingPlayers.current = null;
          setImportStatus(null);
        }}
        onConfirm={async (choice) => {
          setPendingName(null);
          await performImport(choice);
        }}
      />
    </Box>
  );
}
