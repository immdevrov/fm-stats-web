import { Container, Heading, VStack, Box, Text, Spinner, Button, HStack } from "@chakra-ui/react";
import { useState, useRef } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { FileInput } from "../components/ui/file-input";
import { parseHtmlTable, transformPlayerStats } from "../parser/html-parser";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { ImportPreserveDialog, type PreserveCategory } from "../components/ui/import-preserve-dialog";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import type { Player } from "../types/types";

export function ImportView() {
  useDocumentTitle("Import");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    count: number;
    message: string;
  } | null>(null);
  const [preserveOptions, setPreserveOptions] = useState<PreserveCategory[] | null>(null);
  const { refresh } = usePlayerNotes();

  // Store pending import data while dialog is open
  const pendingPlayers = useRef<Player[] | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);

    try {
      // Step 1: Read and parse the file
      const text = await file.text();
      const rawRecords = parseHtmlTable(text);

      if (rawRecords.length === 0) {
        throw new Error("Could not extract table data from the HTML file.");
      }

      // Step 2: Transform records to Player objects
      const players = transformPlayerStats(rawRecords);

      if (players.length === 0) {
        throw new Error("No player data found in the file.");
      }

      // Step 3: Check which categories of preserved data actually exist
      const [rankings, annotations, lists] = await Promise.all([
        db.getLeagueRankings(),
        db.getAnnotations(),
        db.getLists(),
      ]);

      const available: PreserveCategory[] = [];
      if (rankings.length > 0) available.push("rankings");
      if (annotations.some((a) => a.customPosition)) available.push("positions");
      if (
        lists.length > 0 ||
        annotations.some(
          (a) => a.unwanted || a.price !== undefined || a.wageDemand !== undefined || a.note
        )
      ) {
        available.push("lists");
      }

      if (available.length === 0) {
        await performImport(players, []);
      } else {
        pendingPlayers.current = players;
        setIsImporting(false);
        setPreserveOptions(available);
      }
    } catch (error) {
      handleImportError(error);
    }
  };

  const performImport = async (players: Player[], clear: PreserveCategory[]) => {
    try {
      setIsImporting(true);

      if (clear.includes("rankings")) await db.clearLeagueRankings();
      if (clear.includes("positions")) await db.clearAllCustomPositions();

      if (clear.includes("lists")) {
        await db.clearListsAndAnnotations(clear.includes("positions"));
      }

      await db.clearAllPlayers();
      await db.savePlayers(players);
      await refresh();

      // Show success feedback
      const successMessage = `Successfully imported ${players.length} player${players.length !== 1 ? "s" : ""}`;
      setImportStatus({
        success: true,
        count: players.length,
        message: successMessage,
      });

      toaster.create({
        title: "Import Successful",
        description: successMessage,
        type: "success",
        duration: 5000,
      });

      console.log("Parsed and saved players:", players);
    } catch (error) {
      handleImportError(error);
    } finally {
      setIsImporting(false);
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
              <Text color="fg.muted">Processing file and saving to database...</Text>
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
                  await refresh();
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
                  await refresh();
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

      <ImportPreserveDialog
        isOpen={preserveOptions !== null}
        available={preserveOptions ?? []}
        onClose={() => {
          setPreserveOptions(null);
          pendingPlayers.current = null;
          setImportStatus(null);
        }}
        onConfirm={async (clear) => {
          setPreserveOptions(null);
          if (pendingPlayers.current) await performImport(pendingPlayers.current, clear);
        }}
      />
    </Box>
  );
}
