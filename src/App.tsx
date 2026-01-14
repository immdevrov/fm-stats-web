import { Container, Heading, VStack, Box } from "@chakra-ui/react";
import { FileInput } from "./components/ui/file-input";
import { extractPlainTextTable, parseRtfTable, transformPlayerStats } from "./parser/rtf-parser";

function App() {
  const handleFileSelect = async (file: File) => {
    try {
      const text = await file.text();
      const tableLines = extractPlainTextTable(text);

      if (tableLines.length === 0) {
        console.error("Could not extract structured table data from the file.");
        return;
      }

      const rawRecords = parseRtfTable(tableLines);
      const players = transformPlayerStats(rawRecords);

      console.log("Parsed players:", players);
    } catch (error) {
      console.error("Error processing file:", error);
    }
  };

  return (
    <Box minH="100vh" bg="bg.canvas" color="fg.default">
      <Container maxW="container.md" py={8}>
        <VStack gap={8} align="stretch">
          <Heading 
            size="2xl" 
            colorPalette="glaucous"
            color="fg.emphasized"
          >
            FM Stats Web
          </Heading>
          <FileInput onFileSelect={handleFileSelect} accept=".txt,.rtf" />
        </VStack>
      </Container>
    </Box>
  );
}

export default App;
