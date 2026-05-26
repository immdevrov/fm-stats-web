import { Container, Heading, VStack, Box, Text, Spinner, Button } from "@chakra-ui/react";
import { useState, useRef } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { FileInput } from "../components/ui/file-input";
import { parseHtmlTable, transformPlayerStats } from "../parser/html-parser";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import type { Player } from "../types/types";

export function ImportView() {
  useDocumentTitle("Import");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    count: number;
    message: string;
  } | null>(null);
  const [showRankingsDialog, setShowRankingsDialog] = useState(false);

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

      // Step 3: Check if league rankings exist
      const existingRankings = await db.getLeagueRankings();

      if (existingRankings.length > 0) {
        // Store players and show dialog
        pendingPlayers.current = players;
        setIsImporting(false);
        setShowRankingsDialog(true);
      } else {
        // No rankings exist, proceed with import
        await performImport(players);
      }
    } catch (error) {
      handleImportError(error);
    }
  };

  const performImport = async (players: Player[], clearRankings = false) => {
    try {
      setIsImporting(true);

      // Clear data as needed
      if (clearRankings) {
        await db.clearLeagueRankings();
      }
      await db.clearAllPlayers();
      await db.savePlayers(players);

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

  const handleRankingsDialogConfirm = async (value: string) => {
    setShowRankingsDialog(false);

    if (pendingPlayers.current) {
      await performImport(pendingPlayers.current, value === "reset");
    }
  };

  const handleRankingsDialogClose = () => {
    setShowRankingsDialog(false);
    pendingPlayers.current = null;
    setImportStatus(null);
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

          <Button
            variant="outline"
            size="sm"
            colorPalette="red"
            onClick={async () => {
              await db.clearAllCustomPositions();
              toaster.create({
                title: "Custom Positions Cleared",
                description: "All custom position overrides have been removed.",
                type: "success",
                duration: 5000,
              });
            }}
          >
            Clear All Custom Positions
          </Button>
        </VStack>
      </Container>

      <ConfirmDialog
        isOpen={showRankingsDialog}
        onClose={handleRankingsDialogClose}
        onConfirm={handleRankingsDialogConfirm}
        title="League Rankings Found"
        message="You have existing league rankings. Would you like to keep them or reset for the new data?"
        options={[
          {
            label: "Keep Rankings",
            value: "keep",
            description: "Preserve your current league rankings",
          },
          {
            label: "Reset Rankings",
            value: "reset",
            description: "Clear rankings and start fresh with new data",
          },
        ]}
      />
    </Box>
  );
}
