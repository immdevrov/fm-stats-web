import { Container, Heading, VStack, Box, Text, Spinner } from "@chakra-ui/react";
import { useState } from "react";
import { FileInput } from "../components/ui/file-input";
import { extractPlainTextTable, parseRtfTable, transformPlayerStats } from "../parser/rtf-parser";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";

export function ImportView() {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: boolean;
    count: number;
    message: string;
  } | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsImporting(true);
    setImportStatus(null);

    try {
      // Step 1: Read and parse the file
      const text = await file.text();
      const tableLines = extractPlainTextTable(text);

      if (tableLines.length === 0) {
        throw new Error("Could not extract structured table data from the file.");
      }

      // Step 2: Parse the RTF table
      const rawRecords = parseRtfTable(tableLines);
      const players = transformPlayerStats(rawRecords);

      if (players.length === 0) {
        throw new Error("No player data found in the file.");
      }

      // Step 3: Save to IndexedDB
      // Best Practice: Use batch save for better performance
      await db.savePlayers(players);

      // Step 4: Show success feedback
      const successMessage = `Successfully imported ${players.length} player${players.length !== 1 ? 's' : ''}`;
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
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An unknown error occurred during import.";

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
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.md">
        <VStack gap={8} align="stretch">
          <Heading 
            size="2xl" 
            colorPalette="glaucous"
            color="fg.emphasized"
          >
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

          <FileInput 
            onFileSelect={handleFileSelect} 
            accept=".txt,.rtf"
            disabled={isImporting}
          />

          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Select a text or RTF file exported from Football Manager 24.
            The player data will be saved to your browser's local storage.
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
