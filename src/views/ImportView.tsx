import { Container, Heading, VStack, Box, Text, Spinner, Button, HStack } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { FileInput } from "../components/ui/file-input";
import { findMissingColumns, parseHtmlTable, transformPlayerStats } from "../parser/html-parser";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { ImportSaveDialog } from "../components/ui/import-save-dialog";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { useSnapshots } from "../contexts/SnapshotContext";
import type { Player } from "../types/types";

export function ImportView() {
  useDocumentTitle("Import");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    count: number;
    message: string;
  } | null>(null);
  const { refresh: notesRefresh } = usePlayerNotes();
  const { snapshots, refresh, setActive } = useSnapshots();
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
    replacesId: string | null;
  }) => {
    const players = pendingPlayers.current;
    if (!players) return;
    try {
      setIsImporting(true);

      if (choice.mode === "new") {
        await db.clearAllSnapshots();
        await db.clearLeagueRankings();
        await db.clearListsAndAnnotations(true);
        await db.setMyClub(null);
        await db.setSquadPlan(null);
      } else if (choice.replacesId) {
        await db.deleteSnapshot(choice.replacesId);
      }

      const id = await db.createSnapshot(players, { date: choice.date }, (written, total) =>
        setProgress({ written, total })
      );

      await navigator.storage?.persist?.().catch(() => undefined);
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
